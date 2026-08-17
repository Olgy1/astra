import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { invalidatePageCache } from "@/lib/redis";
import { deleteStoredObjects } from "@/lib/storage";

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
      aliasLimit: true,
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
      aliases: {
        select: { id: true, slug: true, createdAt: true, biolink: { select: { id: true, slug: true } } },
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

/**
 * DELETE /api/admin/users/:id
 *
 * Supprime définitivement le compte (RGPD) : médias purgés du stockage,
 * pages, liens, blocks, sessions, signalements et historique supprimés en
 * cascade. Irréversible — l'interface demande une confirmation explicite.
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      status: true,
      biolinks: { select: { slug: true } },
    },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");
  if (target.id === admin.id) {
    throw new ApiError("BAD_REQUEST", "Vous ne pouvez pas supprimer votre propre compte depuis le panel.");
  }

  // 1. Médias : purge des objets dans le stockage (S3 ou local) avant la
  //    suppression des lignes — les clés ne sont plus accessibles après.
  const mediaKeys = await prisma.mediaAsset.findMany({
    where: { ownerId: target.id },
    select: { key: true },
  });
  await deleteStoredObjects(mediaKeys.map((media) => media.key));

  // 2. Invalidation du cache public : les pages supprimées doivent 404,
  //    pas resservir un cache obsolète.
  await Promise.all(target.biolinks.map((biolink) => invalidatePageCache(biolink.slug)));

  // 3. Suppression en cascade : biolinks (liens, blocks, signalements,
  //    suspensions, stats), sessions, tokens, médias, emails.
  await prisma.user.delete({ where: { id: target.id } });

  await writeAdminLog({
    admin,
    action: "user.delete",
    targetType: "user",
    targetId: target.id,
    metadata: {
      username: target.username,
      status: target.status,
      deletedPages: target.biolinks.length,
      deletedMedia: mediaKeys.length,
    },
    ip: clientIp(request),
  });

  return ok({
    message: `${target.username} a été supprimé définitivement (${target.biolinks.length} page(s), ${mediaKeys.length} média(s)).`,
  });
});
