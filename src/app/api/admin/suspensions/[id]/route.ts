import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";

type Context = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/suspensions/:id
 *
 * Supprime une entrée de l'historique des suspensions d'un compte (nettoyage
 * d'anciennes entrées). La page, elle, n'est pas touchée : cette route ne
 * modifie ni `suspendedUntil` ni l'écran « page suspendue ».
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const suspension = await prisma.suspension.findUnique({
    where: { id },
    select: {
      id: true,
      reason: true,
      biolink: { select: { slug: true } },
    },
  });

  if (!suspension) throw new ApiError("NOT_FOUND", "Cette suspension est introuvable.");

  await prisma.suspension.delete({ where: { id } });

  await writeAdminLog({
    admin,
    action: "suspension.delete",
    targetType: "suspension",
    targetId: suspension.id,
    metadata: { biolinkSlug: suspension.biolink.slug, reason: suspension.reason },
    ip: clientIp(request),
  });

  return ok({ message: "Entrée de suspension supprimée." });
});
