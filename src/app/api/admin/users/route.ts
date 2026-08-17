import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, parseQuery, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";

const querySchema = z.object({
  q: z.string().trim().max(64).optional(),
  role: z.enum(["MEMBER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/admin/users?q=&role=&status=&page=
 * Recherche paginée. `q` cherche dans le pseudo, l'email et le discord.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await requireAdmin();
  const query = parseQuery(request, querySchema);

  const where: Prisma.UserWhereInput = {};

  if (query.q) {
    where.OR = [
      { username: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
      { discordUsername: { contains: query.q, mode: "insensitive" } },
    ];
  }

  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        pageLimit: true,
        aliasLimit: true,
        status: true,
        emailVerified: true,
        discordUsername: true,
        createdAt: true,
        lastLogin: true,
        _count: { select: { biolinks: true, aliases: true, sessions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    }),
  ]);

  return ok({
    users,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / (query.pageSize ?? 20))),
    },
  });
});
