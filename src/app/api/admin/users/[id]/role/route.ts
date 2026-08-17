import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { MEMBER_BIOLINK_LIMIT } from "@/lib/biolinks/access";
import { MEMBER_ALIAS_LIMIT } from "@/lib/aliases/access";

type Context = { params: Promise<{ id: string }> };

const roleSchema = z.object({ role: z.enum(["MEMBER", "ADMIN"]) });

/**
 * PATCH /api/admin/users/:id/role
 *
 * Change le rôle d'un compte.
 *
 * La rétrogradation ADMIN → MEMBER est refusée si elle laisse le compte avec
 * plus de biolinks qu'un membre n'en a le droit : sans ce contrôle, on
 * créerait un membre avec plusieurs pages — un état que le reste du système
 * suppose impossible (quota vérifié à la création seulement).
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, roleSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true, pageLimit: true, aliasLimit: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");
  if (target.id === admin.id) {
    throw new ApiError("BAD_REQUEST", "Vous ne pouvez pas changer votre propre rôle.");
  }

  if (target.role === "ADMIN" && input.role === "MEMBER") {
    // -1 = illimité : aucune vérification à faire.
    if (target.pageLimit !== -1) {
      const biolinkCount = await prisma.biolink.count({ where: { ownerId: target.id } });
      // À la rétrogradation, le compte devient soumis à sa limite de membre :
      // la limite personnalisée (ou 1 par défaut) doit couvrir ses pages.
      const allowed = target.pageLimit ?? MEMBER_BIOLINK_LIMIT;

      if (biolinkCount > allowed) {
        throw new ApiError(
          "CONFLICT",
          `Ce compte possède ${biolinkCount} pages pour une limite de ${allowed}. Supprimez-en ${biolinkCount - allowed} avant de le rétrograder, ou augmentez d'abord sa limite.`
        );
      }
    }

    if (target.aliasLimit !== -1) {
      const aliasCount = await prisma.alias.count({ where: { ownerId: target.id } });
      const allowed = target.aliasLimit ?? MEMBER_ALIAS_LIMIT;

      if (aliasCount > allowed) {
        throw new ApiError(
          "CONFLICT",
          `Ce compte possède ${aliasCount} alias pour une limite de ${allowed}. Supprimez-en ${aliasCount - allowed} avant de le rétrograder, ou augmentez d'abord sa limite d'alias.`
        );
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: input.role },
    select: { id: true, username: true, role: true },
  });

  // Un changement de rôle ne révoque pas les sessions : un admin rétrogradé
  // garde ses cookies jusqu'à expiration de son access token (15 min max).
  // C'est assumé — la garde `requireAdmin` relit le rôle en base à chaque
  // requête, donc la sanction est effective immédiatement.

  await writeAdminLog({
    admin,
    action: "user.role",
    targetType: "user",
    targetId: target.id,
    metadata: { username: target.username, from: target.role, to: input.role },
    ip: clientIp(request),
  });

  return ok({ user: updated });
});
