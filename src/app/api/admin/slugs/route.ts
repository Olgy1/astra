import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { slugFormatSchema } from "@/lib/schemas/slug";

const createSchema = z.object({
  slug: slugFormatSchema,
  tier: z.enum(["RESERVED", "PREMIUM"]).default("RESERVED"),
  reason: z.string().trim().max(255).optional(),
});

/**
 * GET /api/admin/slugs
 * Liste des slugs réservés et premium, avec leur tier.
 */
export const GET = withErrorHandling(async () => {
  await requireAdmin();

  const slugs = await prisma.reservedSlug.findMany({
    select: {
      id: true,
      slug: true,
      tier: true,
      reason: true,
      createdAt: true,
    },
    orderBy: [{ tier: "asc" }, { slug: "asc" }],
  });

  return ok({ slugs });
});

/**
 * POST /api/admin/slugs
 * Réserve un slug : RESERVED (interdit à tous) ou PREMIUM (attribuable par
 * un admin). Un slug déjà pris par une page existante ne peut pas être
 * réservé — la réservation doit précéder la création.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, createSchema);
  const slug = input.slug.toLowerCase();

  const [existingPage, existingReservation] = await Promise.all([
    prisma.biolink.findUnique({ where: { slug }, select: { id: true } }),
    prisma.reservedSlug.findUnique({ where: { slug }, select: { id: true, tier: true } }),
  ]);

  if (existingPage) {
    throw new ApiError(
      "CONFLICT",
      "Ce lien est déjà pris par une page existante. Libérez la page avant de réserver le lien."
    );
  }

  if (existingReservation) {
    throw new ApiError("CONFLICT", `Ce lien est déjà réservé (${existingReservation.tier}).`);
  }

  const created = await prisma.reservedSlug.create({
    data: { slug, tier: input.tier, reason: input.reason },
    select: { id: true, slug: true, tier: true, reason: true },
  });

  await writeAdminLog({
    admin,
    action: "slug.reserve",
    targetType: "slug",
    targetId: slug,
    metadata: { tier: input.tier, reason: input.reason ?? null },
    ip: clientIp(request),
  });

  return ok({ slug: created }, 201);
});
