import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, ok, parseQuery, withErrorHandling } from "@/lib/api";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";

const querySchema = z.object({
  biolinkId: z.string().uuid(),
  range: z.enum(["7", "30", "90"]).default("30"),
});

/**
 * GET /api/me/stats?biolinkId=&range=
 *
 * Statistiques d'une page : vues, clics par lien, provenance, appareils, sur
 * la fenêtre demandée.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  const query = parseQuery(request, querySchema);

  // Propriété vérifiée avant tout : on ne lit pas les stats d'un tiers.
  await requireOwnedBiolinkRef(user, query.biolinkId);

  // `?? "30"` : `parseQuery` infère le type d'entrée du schéma, où `range`
  // est optionnel à cause de son `.default()`. Le défaut est bien appliqué à
  // l'exécution, mais TypeScript ne le voit pas — d'où ce garde.
  const days = Number.parseInt(query.range ?? "30", 10);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.analytics.findMany({
    where: { biolinkId: query.biolinkId, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  const biolink = await prisma.biolink.findUnique({
    where: { id: query.biolinkId },
    select: {
      totalViews: true,
      links: { select: { id: true, label: true, clicks: true }, orderBy: { position: "asc" } },
    },
  });

  if (!biolink) throw new ApiError("NOT_FOUND", "Page introuvable.");

  // Agrégation des compteurs JSON sur la période.
  const merge = (key: "referrers" | "devices" | "countries") => {
    const total: Record<string, number> = {};
    for (const row of rows) {
      for (const [k, v] of Object.entries((row[key] as Record<string, number>) ?? {})) {
        total[k] = (total[k] ?? 0) + v;
      }
    }
    return Object.entries(total)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  };

  return ok({
    totalViews: biolink.totalViews,
    periodViews: rows.reduce((sum, row) => sum + row.views, 0),
    periodUniqueViews: rows.reduce((sum, row) => sum + row.uniqueViews, 0),
    // Série temporelle pour le graphe, un point par jour.
    timeline: rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      views: row.views,
      uniqueViews: row.uniqueViews,
    })),
    linksByClicks: [...biolink.links].sort((a, b) => b.clicks - a.clicks),
    referrers: merge("referrers"),
    devices: merge("devices"),
    countries: merge("countries"),
  });
});
