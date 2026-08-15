import { redis, redisKeys } from "@/lib/redis";
import { ApiError } from "@/lib/api";

/**
 * Rate limiting par fenêtre fixe, sur Redis.
 *
 * Le compromis assumé : une fenêtre fixe autorise jusqu'à 2× la limite à
 * cheval sur deux fenêtres (fin de l'une, début de l'autre). Une fenêtre
 * glissante l'éviterait au prix d'un sorted set par identifiant. Pour de
 * l'anti-bruteforce, dépenser 10 essais au lieu de 5 sur une seconde ne
 * change rien à la difficulté de l'attaque : la fenêtre fixe suffit.
 */

export type RateLimitRule = {
  /** Nombre de requêtes autorisées par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes. */
  windowSeconds: number;
};

/**
 * Règles par famille d'endpoint. Les endpoints d'authentification sont
 * volontairement stricts, les endpoints de lecture larges.
 */
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 3, windowSeconds: 3600 },
  emailResend: { limit: 3, windowSeconds: 3600 },
  refresh: { limit: 60, windowSeconds: 300 },
  upload: { limit: 30, windowSeconds: 3600 },
  mutation: { limit: 120, windowSeconds: 60 },
  publicPage: { limit: 240, windowSeconds: 60 },
  report: { limit: 5, windowSeconds: 3600 },
  discordInvite: { limit: 120, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Timestamp Unix (secondes) de réinitialisation de la fenêtre. */
  resetAt: number;
};

/** Borne l'exécution d'une promesse : rejette si elle dépasse le délai. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout Redis")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Consomme une unité de quota.
 *
 * Si Redis est indisponible, on laisse passer (fail-open). C'est un choix :
 * un Redis en panne ne doit pas rendre le site inaccessible. Le risque est
 * qu'une attaque coïncidant avec une panne Redis passe le rate limiting —
 * les autres protections (hash argon2 lent, captcha, verrouillage de compte)
 * restent en place.
 */
export async function consume(
  scope: RateLimitScope,
  identifier: string
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[scope];
  const key = redisKeys.rateLimit(scope, identifier);

  try {
    // INCR puis EXPIRE dans un pipeline : une seule aller-retour réseau.
    // EXPIRE n'est posé qu'à la première incrémentation (count === 1), sinon
    // chaque requête repousserait la fin de fenêtre et le quota ne se
    // réinitialiserait jamais sous charge continue.
    //
    // Redis peut être indisponible (le fail-open ci-dessous le tolère), mais
    // ioredis peut alors faire patienter la commande très longtemps (retries
    // + file d'attente hors-ligne). On borne l'attente : une requête HTTP ne
    // doit pas passer des minutes à attendre un Redis mort.
    const [[, count], [, ttl]] = (await withTimeout(
      redis.multi().incr(key).ttl(key).exec(),
      1500
    )) as [[Error | null, number], [Error | null, number]];

    if (count === 1 || ttl < 0) {
      await redis.expire(key, rule.windowSeconds);
    }

    const effectiveTtl = ttl > 0 ? ttl : rule.windowSeconds;

    return {
      allowed: count <= rule.limit,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt: Math.floor(Date.now() / 1000) + effectiveTtl,
    };
  } catch (error) {
    console.error("[rate-limit] Redis indisponible, requête autorisée :", error);

    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit,
      resetAt: Math.floor(Date.now() / 1000) + rule.windowSeconds,
    };
  }
}

/** En-têtes standard, pour que les clients puissent s'auto-réguler. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}

/**
 * Consomme le quota et lance une ApiError si dépassé. À appeler en première
 * ligne d'un handler.
 */
export async function enforce(
  scope: RateLimitScope,
  identifier: string
): Promise<void> {
  const result = await consume(scope, identifier);

  if (!result.allowed) {
    const retryInSeconds = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
    const retryInMinutes = Math.ceil(retryInSeconds / 60);

    throw new ApiError(
      "RATE_LIMITED",
      `Trop de tentatives. Réessayez dans ${retryInMinutes} minute${retryInMinutes > 1 ? "s" : ""}.`
    );
  }
}

// ---------------------------------------------------------------------------
// Compteur d'échecs de login
//
// Distinct du rate limiting : le rate limit plafonne le débit, ce compteur
// déclenche l'exigence d'un captcha après N échecs sur un même identifiant.
// Il est remis à zéro par un login réussi.
// ---------------------------------------------------------------------------

const LOGIN_FAILURE_TTL_SECONDS = 3600;

export async function recordLoginFailure(identifier: string): Promise<number> {
  const key = redisKeys.loginFailures(identifier.toLowerCase());

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, LOGIN_FAILURE_TTL_SECONDS);
    }
    return count;
  } catch (error) {
    console.error("[rate-limit] échec d'enregistrement du failure :", error);
    return 0;
  }
}

export async function getLoginFailures(identifier: string): Promise<number> {
  try {
    const value = await redis.get(redisKeys.loginFailures(identifier.toLowerCase()));
    return value ? Number.parseInt(value, 10) : 0;
  } catch {
    return 0;
  }
}

export async function clearLoginFailures(identifier: string): Promise<void> {
  try {
    await redis.del(redisKeys.loginFailures(identifier.toLowerCase()));
  } catch (error) {
    console.error("[rate-limit] échec de reset du compteur :", error);
  }
}
