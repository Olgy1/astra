import "server-only";
import type { Alias } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Accès aux alias : quota et propriété.
 *
 * Un alias est une adresse courte qui redirige vers une page bio. Les mêmes
 * gardes que pour les biolinks sont centralisées ici pour ne pas les
 * dupliquer dans chaque handler.
 */

export const MEMBER_ALIAS_LIMIT = 2;

// `aliasLimit` vaut `-1` quand un admin a choisi « illimité » pour un membre.
// C'est une valeur stockée en base, distincte de `null` (limite par défaut).
export const UNLIMITED_ALIAS_LIMIT = -1;

/**
 * Limite effective d'alias d'un compte. null = illimité.
 *
 * Un admin est toujours illimité ; un membre porte soit une limite
 * personnalisée (aliasLimit), soit la limite par défaut, soit `-1`
 * (= illimité).
 */
export function aliasLimitFor(
  role: SessionUser["role"],
  aliasLimit: number | null
): number | null {
  if (role === "ADMIN") return null;
  if (aliasLimit === UNLIMITED_ALIAS_LIMIT) return null;
  return aliasLimit ?? MEMBER_ALIAS_LIMIT;
}

/**
 * Vérifie que l'utilisateur peut créer un alias de plus.
 *
 * Comme pour les biolinks, ce contrôle indicatif est doublé par le trigger
 * Postgres `aliases_enforce_member_quota` (voir sql/001_init.sql), qui ferme
 * réellement la fenêtre de course entre deux créations concurrentes.
 */
export async function assertCanCreateAlias(user: SessionUser): Promise<void> {
  const limit = aliasLimitFor(user.role, user.aliasLimit);
  if (limit === null) return; // alias illimités

  const owned = await prisma.alias.count({ where: { ownerId: user.id } });

  if (owned >= limit) {
    throw new ApiError(
      "QUOTA_EXCEEDED",
      `Votre compte est limité à ${limit} alias. Supprimez-en un pour en créer un autre.`
    );
  }
}

/**
 * Charge un alias en vérifiant que l'utilisateur y a droit.
 *
 * Renvoie NOT_FOUND et non FORBIDDEN quand l'alias appartient à quelqu'un
 * d'autre : répondre « interdit » confirmerait son existence.
 */
export async function requireOwnedAlias(
  user: SessionUser,
  aliasId: string
): Promise<Alias> {
  const alias = await prisma.alias.findUnique({ where: { id: aliasId } });

  if (!alias) {
    throw new ApiError("NOT_FOUND", "Cet alias est introuvable.");
  }

  if (user.role !== "ADMIN" && alias.ownerId !== user.id) {
    throw new ApiError("NOT_FOUND", "Cet alias est introuvable.");
  }

  return alias;
}

/**
 * Traduit une violation du trigger de quota d'alias en erreur d'API lisible.
 */
export function aliasQuotaErrorFromDatabase(error: unknown): ApiError | null {
  const serialized = typeof error === "object" && error !== null ? JSON.stringify(error) : "";

  if (serialized.includes("MEMBER_ALIAS_QUOTA_EXCEEDED")) {
    return new ApiError(
      "QUOTA_EXCEEDED",
      `Votre compte est limité à ${MEMBER_ALIAS_LIMIT} alias.`
    );
  }

  return null;
}
