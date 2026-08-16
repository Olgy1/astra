import { prisma } from "@/lib/db";
import { ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";

/**
 * GET /api/admin/stats
 * Chiffres globaux du tableau de bord : utilisateurs, pages, vues,
 * signalements, inscriptions par jour.
 */
export const GET = withErrorHandling(async () => {
  await requireAdmin();

  const now = new Date();

  const [
    totalUsers,
    activeUsers,
    totalBiolinks,
    publishedBiolinks,
    totalViews,
    uniqueViews,
    pendingReports,
    adminCount,
    suspendedCount,
    bannedCount,
    signupsLast7,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.biolink.count(),
    prisma.biolink.count({ where: { isPublished: true } }),
    prisma.biolink.aggregate({ _sum: { totalViews: true } }),
    prisma.biolink.aggregate({ _sum: { uniqueViews: true } }),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { status: "BANNED" } }),
    prisma.user.count({
      where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } },
    }),
  ]);

  // Inscriptions par jour sur les 14 derniers jours, pour le mini-graphe.
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);

  const signupRows = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const signupsByDay: { date: string; count: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    signupsByDay.push({
      date: key,
      count: signupRows.filter((row) => row.createdAt.toISOString().slice(0, 10) === key).length,
    });
  }

  // Vues et visiteurs uniques par jour sur les 14 derniers jours, agrégés sur
  // toutes les pages, pour le graphe du tableau de bord.
  const analyticsRows = await prisma.analytics.findMany({
    where: { date: { gte: since } },
    select: { date: true, views: true, uniqueViews: true },
  });

  const viewsAccumulator = new Map<string, { views: number; uniqueViews: number }>();
  for (const row of analyticsRows) {
    const key = row.date.toISOString().slice(0, 10);
    const acc = viewsAccumulator.get(key) ?? { views: 0, uniqueViews: 0 };
    acc.views += row.views;
    acc.uniqueViews += row.uniqueViews;
    viewsAccumulator.set(key, acc);
  }

  const viewsByDay: { date: string; views: number; uniqueViews: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const acc = viewsAccumulator.get(key);
    viewsByDay.push({ date: key, views: acc?.views ?? 0, uniqueViews: acc?.uniqueViews ?? 0 });
  }

  return ok({
    totals: {
      users: totalUsers,
      activeUsers,
      suspended: suspendedCount,
      banned: bannedCount,
      admins: adminCount,
      biolinks: totalBiolinks,
      publishedBiolinks,
      pendingReports,
      totalViews: totalViews._sum.totalViews ?? 0,
      uniqueViews: uniqueViews._sum.uniqueViews ?? 0,
      signupsLast7,
    },
    signupsByDay,
    viewsByDay,
  });
});
