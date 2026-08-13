import "server-only";
import type { Biolink } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Accès aux biolinks : quota et propriété.
 *
 * Toutes les routes de gestion passent par ici. Dupliquer ces contrôles dans
 * chaque handler, c'est garantir qu'un jour l'un d'eux sera oublié.
 */

export const MEMBER_BIOLINK_LIMIT = 1;

/**
 * Limite effective de pages d'un compte. null = illimité.
 *
 * Un admin est toujours illimité, quel que soit son `pageLimit` ; un membre
 * porte soit une limite personnalisée (pageLimit), soit la limite par défaut.
 */
export function biolinkLimitFor(
  role: SessionUser["role"],
  pageLimit: number | null
): number | null {
  if (role === "ADMIN") return null;
  return pageLimit ?? MEMBER_BIOLINK_LIMIT;
}

/**
 * Vérifie que l'utilisateur peut créer un biolink de plus.
 *
 * Ce contrôle est le premier des trois, pas le dernier. Entre le `count` et
 * l'`INSERT`, deux requêtes concurrentes passeraient toutes les deux : c'est
 * le trigger Postgres `biolinks_enforce_member_quota` qui ferme réellement la
 * fenêtre (voir sql/001_init.sql). Celui-ci existe pour produire un message
 * clair plutôt qu'une erreur de contrainte brute.
 */
export async function assertCanCreateBiolink(user: SessionUser): Promise<void> {
  const limit = biolinkLimitFor(user.role, user.pageLimit);
  if (limit === null) return; // biolinks illimités

  const owned = await prisma.biolink.count({ where: { ownerId: user.id } });

  if (owned >= limit) {
    throw new ApiError(
      "QUOTA_EXCEEDED",
      `Votre compte est limité à ${limit} page${limit > 1 ? "s" : ""}. Modifiez-en une, ou supprimez-en une pour en créer une autre.`
    );
  }
}

/**
 * Charge un biolink en vérifiant que l'utilisateur y a droit.
 *
 * Renvoie NOT_FOUND et non FORBIDDEN quand la page appartient à quelqu'un
 * d'autre : répondre « interdit » confirmerait son existence et permettrait
 * d'énumérer les identifiants des autres comptes.
 */
export async function requireOwnedBiolink(
  user: SessionUser,
  biolinkId: string
): Promise<Biolink> {
  const biolink = await prisma.biolink.findUnique({ where: { id: biolinkId } });

  if (!biolink) {
    throw new ApiError("NOT_FOUND", "Cette page est introuvable.");
  }

  if (user.role !== "ADMIN" && biolink.ownerId !== user.id) {
    throw new ApiError("NOT_FOUND", "Cette page est introuvable.");
  }

  return biolink;
}

/**
 * Vérifie l'appartenance d'un biolink sans le charger entièrement.
 * Utile quand le handler n'a besoin que du slug (pour invalider le cache).
 */
export async function requireOwnedBiolinkRef(
  user: SessionUser,
  biolinkId: string
): Promise<{ id: string; slug: string; ownerId: string }> {
  const biolink = await prisma.biolink.findUnique({
    where: { id: biolinkId },
    select: { id: true, slug: true, ownerId: true },
  });

  if (!biolink || (user.role !== "ADMIN" && biolink.ownerId !== user.id)) {
    throw new ApiError("NOT_FOUND", "Cette page est introuvable.");
  }

  return biolink;
}

/**
 * Traduit une violation du trigger de quota en erreur d'API lisible.
 *
 * Le trigger lève une `check_violation` PostgreSQL brute. Sans cette
 * traduction, l'utilisateur qui gagne la course recevrait un 500 opaque là où
 * le perdant reçoit un message clair — pour la même cause.
 */
export function quotaErrorFromDatabase(error: unknown): ApiError | null {
  const serialized = typeof error === "object" && error !== null ? JSON.stringify(error) : "";

  if (serialized.includes("MEMBER_BIOLINK_QUOTA_EXCEEDED")) {
    return new ApiError(
      "QUOTA_EXCEEDED",
      "Votre compte est limité à une seule page."
    );
  }

  return null;
}

/** Position suivante dans une liste ordonnée (liens ou blocks). */
export async function nextPosition(
  table: "link" | "block",
  biolinkId: string
): Promise<number> {
  const last =
    table === "link"
      ? await prisma.link.findFirst({
          where: { biolinkId },
          orderBy: { position: "desc" },
          select: { position: true },
        })
      : await prisma.block.findFirst({
          where: { biolinkId },
          orderBy: { position: "desc" },
          select: { position: true },
        });

  return last ? last.position + 1 : 0;
}
