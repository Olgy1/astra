import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Jeton de déverrouillage d'une page protégée par mot de passe.
 *
 * Après saisie correcte, le serveur pose un cookie contenant ce jeton. Au
 * rendu suivant, la page vérifie le cookie plutôt que de redemander le mot de
 * passe à chaque navigation.
 *
 * Le jeton est un HMAC de l'identifiant de la page : il ne contient pas le mot
 * de passe, ne peut pas être forgé sans le secret serveur, et ne déverrouille
 * que la page pour laquelle il a été émis. Il porte aussi une date
 * d'expiration, pour qu'un cookie volé ne vaille pas indéfiniment.
 */

const TTL_MS = 6 * 60 * 60 * 1000; // 6 h

export const UNLOCK_COOKIE_PREFIX = "astra_unlock_";

/** Nom du cookie pour une page donnée. */
export function unlockCookieName(biolinkId: string): string {
  // L'id est un UUID : sûr comme suffixe de nom de cookie.
  return `${UNLOCK_COOKIE_PREFIX}${biolinkId}`;
}

function sign(biolinkId: string, expiresAt: number): string {
  return createHmac("sha256", serverEnv().JWT_ACCESS_SECRET)
    .update(`${biolinkId}.${expiresAt}`)
    .digest("base64url");
}

/** Émet un jeton de déverrouillage. */
export function issueUnlockToken(biolinkId: string): string {
  const expiresAt = Date.now() + TTL_MS;
  return `${expiresAt}.${sign(biolinkId, expiresAt)}`;
}

/** Vérifie un jeton. Retourne false si absent, expiré, ou forgé. */
export function verifyUnlockToken(biolinkId: string, token: string | undefined): boolean {
  if (!token) return false;

  const [expiresPart, signature] = token.split(".");
  if (!expiresPart || !signature) return false;

  const expiresAt = Number.parseInt(expiresPart, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = sign(biolinkId, expiresAt);

  // Comparaison à temps constant : une comparaison naïve fuiterait, octet par
  // octet, de l'information sur la signature attendue.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const UNLOCK_TTL_SECONDS = TTL_MS / 1000;
