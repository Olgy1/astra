import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * Émission et vérification des tokens.
 *
 * Modèle : un access token JWT court (15 min) porté en cookie, et un refresh
 * token opaque long (30 j) adossé à une ligne `sessions`.
 *
 * Pourquoi le refresh token n'est pas un JWT : un JWT est valide tant qu'il
 * n'est pas expiré, on ne peut pas le révoquer sans tenir une liste noire —
 * c'est-à-dire sans refaire une table de sessions. Autant faire du refresh
 * token une clé opaque vers cette table dès le départ : supprimer la ligne
 * suffit alors à couper l'accès, ce qui rend la déconnexion à distance
 * réellement effective.
 */

const ACCESS_ISSUER = "astra.is-a.dev";
const ACCESS_AUDIENCE = "astra.is-a.dev/api";

export type AccessTokenClaims = {
  sub: string;
  username: string;
  role: Role;
  /** Identifiant de session : permet de tracer un access token vers l'appareil. */
  sid: string;
};

function accessSecret(): Uint8Array {
  return new TextEncoder().encode(serverEnv().JWT_ACCESS_SECRET);
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    username: claims.username,
    role: claims.role,
    sid: claims.sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ACCESS_ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(serverEnv().ACCESS_TOKEN_TTL)
    .sign(accessSecret());
}

/**
 * Vérifie un access token. Retourne null si invalide, expiré, ou signé pour
 * un autre issuer/audience — jamais d'exception : un token pourri est un cas
 * nominal, pas une erreur serveur.
 */
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      issuer: ACCESS_ISSUER,
      audience: ACCESS_AUDIENCE,
      algorithms: ["HS256"], // épingle l'algo : bloque l'attaque `alg: none`
    });

    if (!isAccessPayload(payload)) return null;

    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      sid: payload.sid,
    };
  } catch {
    return null;
  }
}

function isAccessPayload(
  payload: JWTPayload
): payload is JWTPayload & { sub: string; username: string; role: Role; sid: string } {
  return (
    typeof payload.sub === "string" &&
    typeof payload.username === "string" &&
    (payload.role === "MEMBER" || payload.role === "ADMIN") &&
    typeof payload.sid === "string"
  );
}

// ---------------------------------------------------------------------------
// Jeton de défi 2FA
// ---------------------------------------------------------------------------

const CHALLENGE_AUDIENCE = "astra.is-a.dev/2fa";

/**
 * Émis par /login quand le mot de passe est bon mais que la 2FA est active.
 * Le client le renvoie à /login/2fa avec son code.
 *
 * Il prouve une seule chose : « le mot de passe de cet utilisateur a été
 * validé il y a moins de 5 minutes ». Sans ce jeton, /login/2fa serait un
 * oracle permettant de brute-forcer un code à 6 chiffres sans connaître le
 * mot de passe — soit un million de possibilités, à la portée d'un script.
 *
 * Audience distincte de celle des access tokens : un jeton de défi présenté
 * comme access token est rejeté par `verifyAccessToken`, et réciproquement.
 */
export async function signChallengeToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ACCESS_ISSUER)
    .setAudience(CHALLENGE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(accessSecret());
}

/** Retourne l'identifiant utilisateur, ou null si le jeton est invalide. */
export async function verifyChallengeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      issuer: ACCESS_ISSUER,
      audience: CHALLENGE_AUDIENCE,
      algorithms: ["HS256"],
    });

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

/**
 * Génère un refresh token opaque : 32 octets d'entropie cryptographique,
 * encodés en base64url. Aucune structure, aucune donnée : il ne sert qu'à
 * retrouver la ligne `sessions` correspondante.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hash d'un token pour le stockage.
 *
 * SHA-256 sans sel, contrairement aux mots de passe. C'est volontaire : le
 * token est déjà 32 octets aléatoires, il n'y a rien à deviner par
 * dictionnaire, et le sel empêcherait la recherche par index (on doit
 * pouvoir faire un `WHERE refresh_token_hash = ?`). Argon2 ici coûterait
 * 50 ms par requête authentifiée pour zéro gain.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Comparaison à temps constant de deux hashs hexadécimaux.
 * Utilisée sur les chemins où le hash n'est pas récupéré par index et doit
 * être comparé en mémoire (vérification d'email, reset de mot de passe).
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  // timingSafeEqual exige des longueurs égales, sinon il lève. La différence
  // de longueur n'est pas un secret ici (les hashs ont une taille fixe).
  if (bufferA.length !== bufferB.length) return false;

  return timingSafeEqual(bufferA, bufferB);
}

export function refreshTokenExpiry(): Date {
  const days = serverEnv().REFRESH_TOKEN_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Tokens à usage unique (vérification email, reset mot de passe)
// ---------------------------------------------------------------------------

export type OneTimeToken = {
  /** À insérer dans le lien envoyé par email. Non stocké en base. */
  token: string;
  /** À stocker dans `verification_tokens.token_hash`. */
  tokenHash: string;
  expiresAt: Date;
};

export function createOneTimeToken(ttlMinutes: number): OneTimeToken {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  };
}

/** Durées de vie des tokens à usage unique. */
export const TOKEN_TTL = {
  /** Assez long pour survivre à une boîte mail relevée le lendemain. */
  emailVerification: 60 * 24,
  /** Court : une fenêtre de reset ouverte est une fenêtre d'attaque. */
  passwordReset: 30,
} as const;
