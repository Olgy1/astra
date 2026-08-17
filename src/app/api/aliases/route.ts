import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser, requireVerifiedUser } from "@/lib/auth/context";
import { aliasLimitFor, assertCanCreateAlias, aliasQuotaErrorFromDatabase } from "@/lib/aliases/access";
import { checkSlugAvailability } from "@/lib/schemas/slug";

/**
 * GET /api/aliases
 * Alias du compte, avec la page cible de chacun.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const aliases = await prisma.alias.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      slug: true,
      createdAt: true,
      biolink: { select: { id: true, slug: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const limit = aliasLimitFor(user.role, user.aliasLimit);

  return ok({
    aliases,
    quota: {
      max: limit,
      used: aliases.length,
      canCreateMore: limit === null || aliases.length < limit,
    },
  });
});

const createAliasSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(32),
  biolinkId: z.string().uuid(),
});

/**
 * POST /api/aliases
 * Crée un alias qui redirige vers une page bio du compte. Exige un email
 * vérifié : un alias publie une adresse, comme une page.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireVerifiedUser();
  await enforce("mutation", clientIp(request));

  const input = await parseBody(request, createAliasSchema);

  await assertCanCreateAlias(user);

  // La page cible doit appartenir au compte : un alias ne peut pas détourner
  // l'adresse vers la page d'un tiers.
  const target = await prisma.biolink.findUnique({
    where: { id: input.biolinkId },
    select: { id: true, ownerId: true, slug: true },
  });

  if (!target || (user.role !== "ADMIN" && target.ownerId !== user.id)) {
    throw new ApiError("NOT_FOUND", "Cette page est introuvable.");
  }

  const availability = await checkSlugAvailability(input.slug, {
    isAdmin: user.role === "ADMIN",
  });

  if (!availability.available) {
    throw new ApiError("CONFLICT", availability.message, {
      slug: [availability.message],
    });
  }

  try {
    const alias = await prisma.alias.create({
      data: {
        ownerId: user.id,
        biolinkId: target.id,
        slug: input.slug,
      },
      select: { id: true, slug: true, biolink: { select: { id: true, slug: true } } },
    });

    return ok({ alias }, 201);
  } catch (error) {
    const quotaError = aliasQuotaErrorFromDatabase(error);
    if (quotaError) throw quotaError;

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError("CONFLICT", "Ce lien vient d'être pris. Choisissez-en un autre.", {
        slug: ["Ce lien vient d'être pris."],
      });
    }

    throw error;
  }
});
