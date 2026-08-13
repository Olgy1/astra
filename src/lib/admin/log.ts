import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Journalisation des actions admin.
 *
 * Toutes les routes du panel admin écrivent une ligne ici. C'est la base de
 * l'audit de sécurité : savoir qui a fait quoi, sur quoi, quand, et depuis
 * quelle IP. Aucune route ne permet d'effacer une ligne — le journal est en
 * append-only par construction (pas de delete exposé).
 *
 * `metadata` porte le contexte de l'action (ancienne valeur, nouvelle valeur,
 * motif…) sans que le schéma de la table n'ait à changer : c'est un Json.
 */
export async function writeAdminLog(input: {
  admin: SessionUser;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  await prisma.adminLog.create({
    data: {
      adminId: input.admin.id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: (input.metadata ?? {}) as object,
      ipAddress: input.ip,
    },
  });
}
