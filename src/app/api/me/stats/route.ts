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

  // Série temporelle pour le graphe : un point par jour sur toute la fenêtre,
  // jours sans activité inclus (à zéro). Sans ce remplissage, le graphe
  // n'afficherait que les jours actifs et donnerait une fausse impression de
  // discontinuité (voir stats-view.tsx).
  const rowByDay = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row]));
  const timeline: { date: string; views: number; uniqueViews: number }[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const row = rowByDay.get(key);
    timeline.push({ date: key, views: row?.views ?? 0, uniqueViews: row?.uniqueViews ?? 0 });
  }

  return ok({
    totalViews: biolink.totalViews,
    periodViews: rows.reduce((sum, row) => sum + row.views, 0),
    periodUniqueViews: rows.reduce((sum, row) => sum + row.uniqueViews, 0),
    timeline,
    linksByClicks: [...biolink.links].sort((a, b) => b.clicks - a.clicks),
    referrers: merge("referrers"),
    devices: merge("devices"),
    countries: merge("countries"),
  });
});
