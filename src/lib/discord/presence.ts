import "server-only";
import { redis, redisKeys } from "@/lib/redis";

/**
 * Présence Discord d'un utilisateur.
 *
 * Forme stable exposée à la page publique. La source est l'API publique de
 * Lanyard (https://lanyard.rest) : elle relaie la présence des utilisateurs
 * inscrits sur son serveur Discord, sans que nous ayons à maintenir une
 * connexion gateway nous-mêmes. Si l'utilisateur n'est pas suivi par Lanyard
 * (ou si le service est indisponible), on renvoie « hors ligne » plutôt que
 * d'échouer — le widget se comporte déjà correctement dans ce cas.
 *
 * Le résultat est mis en cache 30 s : la présence change, mais interroger
 * Lanyard à chaque visiteur d'une page virale le ferait rate-limiter.
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

/**
 * Interroge Lanyard et traduit sa réponse en `Presence`.
 * Ne lance jamais : toute anomalie (réseau, utilisateur non suivi) retombe
 * sur « hors ligne ».
 */
async function fetchFromLanyard(discordId: string): Promise<Presence> {
  const response = await fetch(`${LANYARD_ENDPOINT}/${discordId}`, {
    // Sans cache navigateur : la fraîcheur est gérée par le cache Redis.
    cache: "no-store",
    // Sans timeout, une panne de Lanyard ferait pendre la requête jusqu'au
    // timeout par défaut de fetch.
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return OFFLINE;

  const body = (await response.json()) as { success?: boolean; data?: LanyardData };
  const data = body.success ? body.data : undefined;
  if (!data) return OFFLINE;

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

export async function getDiscordPresence(discordId: string): Promise<Presence> {
  const cacheKey = redisKeys.discordPresence(discordId);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as Presence;
  } catch {
    // Cache indisponible : on retombe sur la valeur par défaut.
  }

  let presence: Presence;
  try {
    presence = await fetchFromLanyard(discordId);
  } catch (error) {
    console.error("[discord] présence indisponible :", error);
    presence = OFFLINE;
  }

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(presence));
  } catch {
    // Échec d'écriture du cache : sans conséquence.
  }

  return presence;
}
