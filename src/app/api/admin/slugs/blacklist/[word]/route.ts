import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";

type Context = { params: Promise<{ word: string }> };

/**
 * DELETE /api/admin/slugs/blacklist/:word
 * Retire un mot de la blacklist : les slugs qui le contiennent redeviennent
 * disponibles (s'ils ne sont pas réservés par ailleurs).
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { word } = await context.params;
  const normalized = word.trim().toLowerCase();

  const existing = await prisma.slugBlacklist.findUnique({
    where: { word: normalized },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError("NOT_FOUND", `Le mot « ${normalized} » n'est pas dans la blacklist.`);
  }

  await prisma.slugBlacklist.delete({ where: { id: existing.id } });

  await writeAdminLog({
    admin,
    action: "slug.blacklist.remove",
    targetType: "slug",
    targetId: normalized,
    ip: clientIp(request),
  });

  return ok({ message: `Le mot « ${normalized} » a été retiré de la blacklist.` });
});
