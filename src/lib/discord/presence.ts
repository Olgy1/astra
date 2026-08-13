import "server-only";
import { redis, redisKeys } from "@/lib/redis";

/**
 * Présence Discord d'un utilisateur.
 *
 * Forme stable exposée à la page publique. La source réelle (Lanyard, ou une
 * connexion gateway maison) est branchée à l'étape 7 ; en attendant, cette
 * fonction renvoie un état « hors ligne » plutôt que d'échouer, pour que le
 * widget se comporte déjà correctement.
 *
 * Le résultat est mis en cache 30 s : la présence change, mais interroger
 * Discord à chaque visiteur d'une page virale le ferait rate-limiter.
 */

export type Presence = {
  status: "online" | "idle" | "dnd" | "offline";
  activity: { name: string; details?: string; state?: string; largeImage?: string } | null;
  spotify: { song: string; artist: string; albumArt?: string } | null;
};

const OFFLINE: Presence = { status: "offline", activity: null, spotify: null };
const CACHE_TTL_SECONDS = 30;

export async function getDiscordPresence(discordId: string): Promise<Presence> {
  const cacheKey = redisKeys.discordPresence(discordId);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as Presence;
  } catch {
    // Cache indisponible : on retombe sur la valeur par défaut.
  }

  // TODO(étape 7) : interroger Lanyard ou la gateway Discord ici.
  // La structure de retour est déjà celle attendue par le widget, donc le
  // câblage se limitera à remplir `presence` — le composant ne changera pas.
  const presence = OFFLINE;

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(presence));
  } catch {
    // Échec d'écriture du cache : sans conséquence.
  }

  return presence;
}
