import "server-only";
import { serverEnv } from "@/lib/env";
import { redis, redisKeys } from "@/lib/redis";

/**
 * Présence Discord d'un utilisateur.
 *
 * Sources, dans l'ordre :
 *  1. Le bot auto-hébergé (dossier `discord-presence-bot/`), si la variable
 *     `DISCORD_PRESENCE_URL` est définie. Il expose la même forme d'API que
 *     Lanyard, donc le même traducteur sert aux deux.
 *  2. L'API publique de Lanyard (https://lanyard.rest), en secours — utile
 *     quand l'utilisateur n'est pas suivi par le bot (pas de serveur partagé).
 *  3. « hors ligne » : jamais d'échec — le widget se comporte déjà
 *     correctement dans ce cas.
 *
 * Le résultat est mis en cache 30 s : la présence change, mais interroger la
 * source à chaque visiteur d'une page virale la ferait rate-limiter.
 */

export type Presence = {
  status: "online" | "idle" | "dnd" | "offline";
  activity: { name: string; details?: string; state?: string; largeImage?: string } | null;
  spotify: { song: string; artist: string; albumArt?: string } | null;
};

const OFFLINE: Presence = { status: "offline", activity: null, spotify: null };
const CACHE_TTL_SECONDS = 30;

const LANYARD_ENDPOINT = "https://api.lanyard.rest/v1/users";

type LanyardActivity = {
  type?: number;
  name?: string;
  details?: string | null;
  state?: string | null;
  assets?: { large_image?: string } | null;
};

type LanyardData = {
  discord_status?: "online" | "idle" | "dnd" | "offline";
  listening_to_spotify?: boolean;
  spotify?: { song?: string; artist?: string; album_art_url?: string };
  activities?: LanyardActivity[];
};

/** Traduit la forme d'API commune (Lanyard et bot auto-hébergé) en `Presence`. */
function translateData(data: LanyardData): Presence {
  const status = data.discord_status ?? "offline";

  const spotify =
    data.listening_to_spotify && data.spotify?.song && data.spotify.artist
      ? {
          song: data.spotify.song,
          artist: data.spotify.artist,
          albumArt: data.spotify.album_art_url ?? undefined,
        }
      : null;

  // Activité affichée : un jeu (0), un stream (1), un visionnage (3) ou une
  // compétition (5). On écarte le statut personnalisé (4) et l'écoute (2) —
  // cette dernière correspond en général à Spotify, géré à part ci-dessus.
  const entry = (data.activities ?? []).find(
    (activity) =>
      activity.type !== undefined &&
      [0, 1, 3, 5].includes(activity.type) &&
      Boolean(activity.name)
  );

  const activity = entry
    ? {
        name: entry.name!,
        details: entry.details ?? undefined,
        state: entry.state ?? undefined,
        largeImage: entry.assets?.large_image ?? undefined,
      }
    : null;

  return { status, activity, spotify };
}

/**
 * Interroge une source (bot auto-hébergé ou Lanyard) et traduit sa réponse.
 * Renvoie `null` si la source ne suit pas cet utilisateur ou est injoignable —
 * l'appelant décide du repli.
 */
async function fetchFromEndpoint(endpoint: string, discordId: string): Promise<Presence | null> {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/${discordId}`, {
    // Sans cache navigateur : la fraîcheur est gérée par le cache Redis.
    cache: "no-store",
    // Sans timeout, une panne de la source ferait pendre la requête jusqu'au
    // timeout par défaut de fetch.
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return null;

  const body = (await response.json()) as { success?: boolean; data?: LanyardData };
  if (!body.success || !body.data) return null;

  return translateData(body.data);
}

export async function getDiscordPresence(discordId: string): Promise<Presence> {
  const cacheKey = redisKeys.discordPresence(discordId);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as Presence;
  } catch {
    // Cache indisponible : on retombe sur la valeur par défaut.
  }

  let presence: Presence = OFFLINE;

  // 1. Bot auto-hébergé (s'il est configuré).
  const selfHostedUrl = serverEnv().DISCORD_PRESENCE_URL;
  if (selfHostedUrl) {
    try {
      presence = (await fetchFromEndpoint(selfHostedUrl, discordId)) ?? OFFLINE;
    } catch (error) {
      console.error("[discord] bot auto-hébergé indisponible :", error);
    }
  }

  // 2. Secours Lanyard — seulement si le bot ne connaît pas cet utilisateur
  // (un « hors ligne » du bot est une vraie réponse, pas un échec à ignorer).
  if (presence.status === "offline" && !presence.activity && !presence.spotify) {
    try {
      presence = (await fetchFromEndpoint(LANYARD_ENDPOINT, discordId)) ?? OFFLINE;
    } catch (error) {
      console.error("[discord] présence indisponible :", error);
    }
  }

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(presence));
  } catch {
    // Échec d'écriture du cache : sans conséquence.
  }

  return presence;
}
