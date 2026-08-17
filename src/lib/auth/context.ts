import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { ACCESS_COOKIE, type SessionUser } from "@/lib/auth/session";

/**
 * Lecture de l'utilisateur courant, et gardes d'autorisation.
 *
 * Toutes les décisions d'accès de la plateforme passent par ici. Le rôle
 * vient du token signé, jamais d'un en-tête ou du corps de la requête.
 */

/**
 * Utilisateur courant, ou null.
 *
 * Le JWT porte déjà l'identifiant et le rôle, mais on relit la base à chaque
 * appel. C'est un aller-retour de plus, assumé : sans lui, un utilisateur
 * banni ou rétrogradé garderait ses droits jusqu'à l'expiration de son access
 * token. Quinze minutes d'admin pour quelqu'un qu'on vient de rétrograder,
 * c'est quinze minutes de trop.
 *
 * Si ce coût devient un problème, la parade est de cacher l'utilisateur dans
 * Redis avec un TTL court et d'invalider la clé au changement de rôle ou de
 * statut — pas de faire confiance au token.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;

  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      pageLimit: true,
      aliasLimit: true,
      status: true,
      emailVerified: true,
      twoFactorEnabled: true,
      discordId: true,
      suspendedUntil: true,
    },
  });

  if (!user) return null;

  // La session a-t-elle été révoquée à distance depuis l'émission du token ?
  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: { id: true, expiresAt: true },
  });

  if (!session || session.expiresAt < new Date()) return null;

  if (user.status === "BANNED") return null;

  if (user.status === "SUSPENDED") {
    const stillSuspended = !user.suspendedUntil || user.suspendedUntil > new Date();
    if (stillSuspended) return null;

    // La suspension est arrivée à terme : on relève le compte à la volée
    // plutôt que d'attendre un cron.
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", suspendedUntil: null, statusReason: null },
    });
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    pageLimit: user.pageLimit,
    aliasLimit: user.aliasLimit,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    discordId: user.discordId,
    sessionId: claims.sid,
  };
}

/** Exige une session. Lance UNAUTHENTICATED sinon. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError("UNAUTHENTICATED", "Vous devez être connecté.");
  }

  return user;
}

/**
 * Exige une session et un email vérifié.
 *
 * Garde posée sur tout ce qui crée du contenu public. Sans elle, on pourrait
 * publier une page depuis une adresse email qui n'est pas la sienne — ce qui
 * rend le signalement d'abus inopérant.
 */
export async function requireVerifiedUser(): Promise<SessionUser> {
  const user = await requireUser();

  if (!user.emailVerified) {
    throw new ApiError(
      "EMAIL_NOT_VERIFIED",
      "Confirmez votre adresse email pour accéder à cette fonctionnalité."
    );
  }

  return user;
}

/** Exige le rôle admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    throw new ApiError("FORBIDDEN", "Cette action est réservée aux administrateurs.");
  }

  return user;
}

export function isAdmin(user: { role: Role } | null): boolean {
  return user?.role === "ADMIN";
}

/**
 * Exige d'être propriétaire de la ressource, ou admin.
 *
 * Renvoie NOT_FOUND et non FORBIDDEN quand l'utilisateur n'a aucun droit :
 * répondre « interdit » confirmerait l'existence de la ressource, et
 * permettrait d'énumérer les identifiants des autres.
 */
export function assertOwnership(
  user: SessionUser,
  ownerId: string,
  resourceLabel = "Cette ressource"
): void {
  if (user.role === "ADMIN") return;

  if (user.id !== ownerId) {
    throw new ApiError("NOT_FOUND", `${resourceLabel} est introuvable.`);
  }
}
