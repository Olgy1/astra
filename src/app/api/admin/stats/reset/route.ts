import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { invalidateAllPageCache } from "@/lib/redis";

/**
 * POST /api/admin/stats/reset
 * Réinitialise à zéro les statistiques de la plateforme entière : compteurs
 * dénormalisés de chaque page (vues totales, visites uniques), agrégats
 * journaliers (analytics) et les empreintes de navigateurs qui servent au
 * dédoublonnage des visites. Les pages existantes ne sont pas touchées —
 * seuls leurs compteurs repartent de zéro.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const admin = await requireAdmin();

  // Transaction globale : tout remettre à zéro d'un bloc, pour ne jamais
  // afficher un compteur dénormalisé (biolinks) et ses détails (analytics)
  // désynchronisés — y compris le temps d'une seule requête.
  await prisma.$transaction([
    prisma.biolink.updateMany({ data: { totalViews: 0, uniqueViews: 0 } }),
    prisma.analytics.deleteMany({}),
    prisma.viewFingerprint.deleteMany({}),
  ]);

  await invalidateAllPageCache();

  await writeAdminLog({
    admin,
    action: "stats.reset",
    targetType: "stats",
    targetId: "global",
    ip: clientIp(request),
  });

  return ok({ message: "Toutes les statistiques de vues et visites ont été réinitialisées." });
});
