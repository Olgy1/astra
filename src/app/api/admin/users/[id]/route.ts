import { prisma } from "@/lib/db";
import { ApiError, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/users/:id
 * Fiche complète : compte, biolinks, sessions actives, signalements émis et reçus.
 */
export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  await requireAdmin();
  const { id } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      pageLimit: true,
      status: true,
      emailVerified: true,
      emailVerifiedAt: true,
      discordId: true,
      discordUsername: true,
      twoFactorEnabled: true,
      statusReason: true,
      suspendedUntil: true,
      createdAt: true,
      lastLogin: true,
      biolinks: {
        select: {
          id: true,
          slug: true,
          title: true,
          isPublished: true,
          isPasswordProtected: true,
          suspendedUntil: true,
          totalViews: true,
          uniqueViews: true,
          createdAt: true,
          _count: { select: { links: true, blocks: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      sessions: {
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
        orderBy: { lastUsedAt: "desc" },
        take: 20,
      },
      reportsMade: {
        select: {
          id: true,
          biolink: { select: { id: true, slug: true } },
          reason: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  // Historique des suspensions de page du compte : une ligne par suspension
  // (qui, quand, durée, motif, page), la plus récente d'abord.
  const suspensions = await prisma.suspension.findMany({
    where: { biolink: { ownerId: id } },
    select: {
      id: true,
      reason: true,
      startedAt: true,
      until: true,
      liftedAt: true,
      biolink: { select: { id: true, slug: true, suspendedUntil: true } },
      admin: { select: { id: true, username: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  if (!user) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  const reportsAgainst = await prisma.report.findMany({
    where: { biolink: { ownerId: id } },
    select: {
      id: true,
      biolink: { select: { id: true, slug: true } },
      reason: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok({ user: { ...user, reportsAgainst, suspensions } });
});
