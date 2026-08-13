import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";

type Context = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/users/:id/sessions
 * Déconnecte tous les appareils d'un utilisateur, sans toucher au compte.
 * Utile quand un appareil est perdu ou qu'une session semble compromise.
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  const result = await prisma.session.deleteMany({ where: { userId: target.id } });

  await writeAdminLog({
    admin,
    action: "user.revoke_sessions",
    targetType: "user",
    targetId: target.id,
    metadata: { username: target.username, revoked: result.count },
    ip: clientIp(request),
  });

  return ok({
    message: `${result.count} session(s) de ${target.username} ont été révoquée(s).`,
    revoked: result.count,
  });
});
