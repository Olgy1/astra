import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseQuery, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";

const querySchema = z.object({
  adminId: z.string().uuid().optional(),
  action: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

/**
 * GET /api/admin/logs?adminId=&action=&page=
 *
 * Journal d'audit, lecture seule. Aucune route ne permet d'en effacer une
 * ligne : c'est la condition pour qu'il serve à quelque chose.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await requireAdmin();
  const query = parseQuery(request, querySchema);

  const where = {
    ...(query.adminId ? { adminId: query.adminId } : {}),
    ...(query.action ? { action: { contains: query.action } } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.adminLog.count({ where }),
    prisma.adminLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        admin: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 30),
      take: query.pageSize ?? 30,
    }),
  ]);

  return ok({
    logs,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / (query.pageSize ?? 30))),
    },
  });
});
