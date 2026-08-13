import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { revokeAllSessions } from "@/lib/auth/session";
import { invalidatePageCache } from "@/lib/redis";

type Context = { params: Promise<{ id: string }> };

const banSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/users/:id/ban
 *
 * Bannit définitivement : toutes ses pages sont dépubliées, toutes ses
 * sessions révoquées, il ne peut plus se connecter. Le compte n'est pas
 * supprimé — les liens vers son contenu restent résolubles, mais vides.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, banSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, status: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");
  if (target.id === admin.id) {
    throw new ApiError("BAD_REQUEST", "Vous ne pouvez pas bannir votre propre compte.");
  }

  // Dépublier avant de bannir : une page publiée reste accessible après le
  // ban via le cache public si on ne la retire pas d'abord.
  const biolinks = await prisma.biolink.findMany({
    where: { ownerId: target.id, isPublished: true },
    select: { id: true, slug: true },
  });

  if (biolinks.length > 0) {
    await prisma.biolink.updateMany({
      where: { ownerId: target.id },
      data: { isPublished: false },
    });
    await Promise.all(biolinks.map((biolink) => invalidatePageCache(biolink.slug)));
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { status: "BANNED", statusReason: input.reason ?? null, suspendedUntil: null },
  });

  const revoked = await revokeAllSessions(target.id);

  await writeAdminLog({
    admin,
    action: "user.ban",
    targetType: "user",
    targetId: target.id,
    metadata: {
      username: target.username,
      reason: input.reason ?? null,
      unpublishedPages: biolinks.length,
      revokedSessions: revoked,
    },
    ip: clientIp(request),
  });

  return ok({
    message: `${target.username} a été banni.`,
    unpublishedPages: biolinks.length,
    revokedSessions: revoked,
  });
});
