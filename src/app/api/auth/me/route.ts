import { prisma } from "@/lib/db";
import { ok, withErrorHandling } from "@/lib/api";
import { requireUser } from "@/lib/auth/context";
import { biolinkLimitFor } from "@/lib/biolinks/access";
import { aliasLimitFor } from "@/lib/aliases/access";

/**
 * GET /api/auth/me
 *
 * Utilisateur courant, ses biolinks, et son quota. Appelé au chargement des
 * panels pour amorcer l'état client.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const biolinks = await prisma.biolink.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      totalViews: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const limit = biolinkLimitFor(user.role, user.pageLimit);

  const [aliases, aliasLimit] = await Promise.all([
    prisma.alias.findMany({
      where: { ownerId: user.id },
      select: { id: true, slug: true, biolink: { select: { id: true, slug: true } } },
      orderBy: { createdAt: "asc" },
    }),
    Promise.resolve(aliasLimitFor(user.role, user.aliasLimit)),
  ]);

  return ok({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      pageLimit: user.pageLimit,
      aliasLimit: user.aliasLimit,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      discordLinked: Boolean(user.discordId),
    },
    biolinks,
    aliases,
    quota: {
      // Le front s'en sert pour masquer le bouton de création. Ce n'est pas
      // la garde : la limite est appliquée par l'API et par un trigger
      // Postgres (voir sql/001_init.sql).
      max: limit,
      used: biolinks.length,
      canCreateMore: limit === null || biolinks.length < limit,
    },
    aliasQuota: {
      max: aliasLimit,
      used: aliases.length,
      canCreateMore: aliasLimit === null || aliases.length < aliasLimit,
    },
  });
});
