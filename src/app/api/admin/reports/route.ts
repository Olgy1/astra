import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseQuery, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";

const querySchema = z.object({
  status: z.enum(["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"]).optional(),
  reason: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/admin/reports?status=&reason=
 * File de modération : les signalements, du plus récent au plus ancien,
 * filtrés par statut et/ou motif. PENDING par défaut, c'est-à-dire la file à
 * traiter.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await requireAdmin();
  const query = parseQuery(request, querySchema);

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.reason ? { reason: query.reason } : {}),
  };

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      select: {
        id: true,
        reason: true,
        details: true,
        status: true,
        resolutionNote: true,
        createdAt: true,
        resolvedAt: true,
        resolvedBy: true,
        reporter: { select: { id: true, username: true } },
        biolink: {
          select: {
            id: true,
            slug: true,
            title: true,
            isPublished: true,
            suspendedUntil: true,
            suspensionReason: true,
            owner: { select: { id: true, username: true, email: true } },
            _count: { select: { links: true, blocks: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    }),
  ]);

  // `resolvedBy` est un UUID scalaire (pas une relation Prisma) : on résout
  // les pseudos des modérateurs en une seule requête groupée.
  const resolvedByIds = [...new Set(reports.map((report) => report.resolvedBy).filter(Boolean))] as string[];
  const resolvers = resolvedByIds.length
    ? await prisma.user.findMany({
        where: { id: { in: resolvedByIds } },
        select: { id: true, username: true },
      })
    : [];

  const resolverByUsername = new Map(resolvers.map((user) => [user.id, user.username]));

  return ok({
    reports: reports.map((report) => ({
      ...report,
      resolvedBy: report.resolvedBy
        ? { id: report.resolvedBy, username: resolverByUsername.get(report.resolvedBy) ?? "Inconnu" }
        : null,
    })),
    pagination: {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total,
      totalPages: Math.max(1, Math.ceil(total / (query.pageSize ?? 20))),
    },
  });
});
