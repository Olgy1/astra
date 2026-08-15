import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { invalidatePageCache } from "@/lib/redis";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/biolinks/:id/stats
 * Réinitialise à zéro les statistiques de la page : compteurs dénormalisés
 * (vues totales, visites uniques), agrégats journaliers (analytics) et les
 * empreintes de navigateurs qui servent au dédoublonnage des visites.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const biolink = await prisma.biolink.findUnique({
    where: { id },
    select: { id: true, slug: true, ownerId: true },
  });

  if (!biolink) throw new ApiError("NOT_FOUND", "Cette page est introuvable.");

  // Transaction : tout remettre à zéro d'un bloc, pour ne jamais afficher un
  // compteur dénormalisé (biolinks) et ses détails (analytics) désynchronisés.
  await prisma.$transaction([
    prisma.biolink.update({
      where: { id },
      data: { totalViews: 0, uniqueViews: 0 },
    }),
    prisma.analytics.deleteMany({ where: { biolinkId: id } }),
    prisma.viewFingerprint.deleteMany({ where: { biolinkId: id } }),
  ]);

  await invalidatePageCache(biolink.slug);

  await writeAdminLog({
    admin,
    action: "biolink.reset_stats",
    targetType: "biolink",
    targetId: biolink.id,
    metadata: { slug: biolink.slug, ownerId: biolink.ownerId },
    ip: clientIp(request),
  });

  return ok({ message: `Les statistiques de astraa.is-cool.dev/${biolink.slug} ont été réinitialisées.` });
});
