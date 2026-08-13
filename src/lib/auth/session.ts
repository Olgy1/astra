import { cookies } from "next/headers";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
} from "@/lib/auth/tokens";

/**
 * Cycle de vie des sessions.
 *
 * Une session = une ligne en base + un refresh token opaque chez le client.
 * L'access token JWT est dérivé de la session et n'a pas d'existence propre.
 */

export const ACCESS_COOKIE = "astra_at";
export const REFRESH_COOKIE = "astra_rt";

function isProduction(): boolean {
  return serverEnv().NODE_ENV === "production";
}

/**
 * Options des cookies d'authentification.
 *
 * `httpOnly` : le token est invisible au JavaScript, donc un XSS ne peut pas
 * le lire. C'est la raison d'être du cookie ici — un `localStorage` serait
 * lisible par n'importe quel script injecté.
 *
 * `sameSite: lax` : le cookie n'est pas envoyé sur les requêtes cross-site
 * autres qu'une navigation de premier niveau, ce qui neutralise le CSRF sur
 * les POST. `strict` casserait le retour du callback OAuth Discord.
 *
 * `secure` en production uniquement : un cookie Secure n'est pas transmis en
 * clair, mais localhost n'est pas en HTTPS.
 */
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * Le refresh token est restreint à `/api/auth` : il n'est pas envoyé sur les
 * autres requêtes. Réduire sa surface d'exposition réduit le nombre
 * d'endroits où il peut fuiter (logs de proxy, en-têtes rejoués).
 */
function refreshCookieOptions() {
  return { ...baseCookieOptions(), path: "/api/auth" };
}

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  role: Role;
  // Limite de pages personnalisée (NULL = défaut : 1 pour un membre, illimité
  // pour un admin). Portée par la session car elle est relue en base à chaque
  // getCurrentUser — changer la limite prend effet immédiatement.
  pageLimit: number | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  discordId: string | null;
  sessionId: string;
};

/**
 * Ouvre une session : crée la ligne, pose les deux cookies.
 * Appelé après un login réussi, une inscription, ou un callback OAuth.
 */
export async function createSession(
  user: Pick<User, "id" | "username" | "role">,
  context: { userAgent?: string | null; ipAddress?: string | null }
): Promise<{ refreshToken: string; sessionId: string }> {
  const refreshToken = generateRefreshToken();

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: context.userAgent?.slice(0, 500) ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt: refreshTokenExpiry(),
    },
    select: { id: true },
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    sid: session.id,
  });

  const store = await cookies();

  store.set(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    // Le cookie survit délibérément à l'expiration du JWT qu'il contient :
    // sinon le navigateur l'effacerait et le client ne saurait plus qu'il a
    // une session à rafraîchir. C'est la signature du JWT qui fait foi, pas
    // la présence du cookie.
    maxAge: serverEnv().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });

  store.set(REFRESH_COOKIE, refreshToken, {
    ...refreshCookieOptions(),
    maxAge: serverEnv().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });

  return { refreshToken, sessionId: session.id };
}

export type RefreshOutcome =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "NO_TOKEN" | "INVALID" | "EXPIRED" | "USER_BLOCKED" };

/**
 * Rafraîchit une session : vérifie le refresh token, le fait tourner, réémet
 * un access token.
 *
 * Rotation à chaque usage : le token présenté est remplacé. Un token volé
 * n'est utilisable qu'une fois, et si le légitime propriétaire s'en sert
 * ensuite, son ancien token ne marche plus — il est déconnecté, ce qui rend
 * le vol visible plutôt que silencieux.
 */
export async function refreshSession(): Promise<RefreshOutcome> {
  const store = await cookies();
  const presented = store.get(REFRESH_COOKIE)?.value;

  if (!presented) return { ok: false, reason: "NO_TOKEN" };

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hashToken(presented) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          pageLimit: true,
          status: true,
          emailVerified: true,
          twoFactorEnabled: true,
          discordId: true,
          suspendedUntil: true,
        },
      },
    },
  });

  if (!session) {
    await clearSessionCookies();
    return { ok: false, reason: "INVALID" };
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    await clearSessionCookies();
    return { ok: false, reason: "EXPIRED" };
  }

  // Un compte banni ou suspendu ne doit pas pouvoir prolonger sa session :
  // l'access token étant court, c'est ici que la sanction prend effet.
  const blocked =
    session.user.status === "BANNED" ||
    (session.user.status === "SUSPENDED" &&
      (!session.user.suspendedUntil || session.user.suspendedUntil > new Date()));

  if (blocked) {
    await prisma.session.deleteMany({ where: { userId: session.user.id } });
    await clearSessionCookies();
    return { ok: false, reason: "USER_BLOCKED" };
  }

  const rotated = generateRefreshToken();

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(rotated),
      lastUsedAt: new Date(),
      expiresAt: refreshTokenExpiry(),
    },
  });

  const accessToken = await signAccessToken({
    sub: session.user.id,
    username: session.user.username,
    role: session.user.role,
    sid: session.id,
  });

  const maxAge = serverEnv().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
  store.set(ACCESS_COOKIE, accessToken, { ...baseCookieOptions(), maxAge });
  store.set(REFRESH_COOKIE, rotated, { ...refreshCookieOptions(), maxAge });

  return {
    ok: true,
    user: {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      role: session.user.role,
      pageLimit: session.user.pageLimit,
      emailVerified: session.user.emailVerified,
      twoFactorEnabled: session.user.twoFactorEnabled,
      discordId: session.user.discordId,
      sessionId: session.id,
    },
  };
}

/** Ferme la session courante et efface les cookies. */
export async function destroySession(sessionId?: string): Promise<void> {
  const store = await cookies();
  const presented = store.get(REFRESH_COOKIE)?.value;

  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  } else if (presented) {
    await prisma.session
      .delete({ where: { refreshTokenHash: hashToken(presented) } })
      .catch(() => {});
  }

  await clearSessionCookies();
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { ...baseCookieOptions(), maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...refreshCookieOptions(), maxAge: 0 });
}

/**
 * Révoque toutes les sessions d'un utilisateur, sauf éventuellement une.
 * Appelé au changement de mot de passe, au bannissement, et depuis le panel.
 */
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
  });

  return result.count;
}

/**
 * Purge les sessions expirées.
 *
 * À appeler périodiquement (cron). Sans ça, la table grossit indéfiniment :
 * une session expirée n'est jamais supprimée par le flux normal, puisque son
 * propriétaire ne revient précisément pas.
 */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return result.count;
}
