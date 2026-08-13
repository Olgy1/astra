import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";

type Context = { params: Promise<{ slug: string }> };

/**
 * DELETE /api/admin/slugs/:slug
 * Libère un slug : il redevient disponible à la création pour tout le monde.
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { slug } = await context.params;
  const normalized = slug.toLowerCase();

  const existing = await prisma.reservedSlug.findUnique({
    where: { slug: normalized },
    select: { id: true, tier: true },
  });

  if (!existing) {
    throw new ApiError("NOT_FOUND", `Le lien « ${normalized} » n'est pas réservé.`);
  }

  await prisma.reservedSlug.delete({ where: { id: existing.id } });

  await writeAdminLog({
    admin,
    action: "slug.release",
    targetType: "slug",
    targetId: normalized,
    metadata: { tier: existing.tier },
    ip: clientIp(request),
  });

  return ok({ message: `Le lien « ${normalized} » a été libéré.` });
});
