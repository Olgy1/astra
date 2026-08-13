import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, parseQuery, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";

const querySchema = z.object({
  type: z.string().trim().max(64).optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

/**
 * GET /api/admin/emails?type=&status=&page=
 *
 * Historique des emails envoyés par le système (EmailLog), lecture seule.
 * Réservé aux admins : un membre ne doit pas savoir qui a reçu quoi.
 *
 * La liste ne contient que des métadonnées (destinataire, type, statut,
 * dates, erreur éventuelle) — jamais le contenu ni les tokens.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await requireAdmin();
  const query = parseQuery(request, querySchema);

  const where = {
    ...(query.type ? { type: query.type as never } : {}),
    ...(query.status ? { status: query.status as never } : {}),
  };

  const [total, emails] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      select: {
        id: true,
        email: true,
        type: true,
        status: true,
        subject: true,
        providerMessageId: true,
        error: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 30),
      take: query.pageSize ?? 30,
    }),
  ]);

  return ok({
    emails,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / (query.pageSize ?? 30))),
    },
  });
});
