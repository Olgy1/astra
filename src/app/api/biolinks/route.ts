import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser, requireVerifiedUser } from "@/lib/auth/context";
import {
  assertCanCreateBiolink,
  biolinkLimitFor,
  quotaErrorFromDatabase,
} from "@/lib/biolinks/access";
import { checkSlugAvailability } from "@/lib/schemas/slug";
import { defaultThemeConfig } from "@/lib/schemas/theme";
import { createBiolinkSchema } from "@/lib/schemas/biolink";
import { defaultBlockConfig } from "@/lib/blocks/registry";

/**
 * GET /api/biolinks
 * Pages de l'utilisateur. Un membre en a 0 ou 1, un admin autant qu'il veut.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const biolinks = await prisma.biolink.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isPublished: true,
      isPasswordProtected: true,
      totalViews: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { links: true, blocks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const limit = biolinkLimitFor(user.role, user.pageLimit);

  return ok({
    biolinks,
    quota: {
      max: limit,
      used: biolinks.length,
      canCreateMore: limit === null || biolinks.length < limit,
    },
  });
});

/**
 * POST /api/biolinks
 * Crée une page. Exige un email vérifié : sans cela, on pourrait publier du
 * contenu public depuis une adresse qui n'est pas la sienne, ce qui rend le
 * signalement d'abus inopérant.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireVerifiedUser();
  await enforce("mutation", clientIp(request));

  const input = await parseBody(request, createBiolinkSchema);

  await assertCanCreateBiolink(user);

  const availability = await checkSlugAvailability(input.slug, {
    isAdmin: user.role === "ADMIN",
  });

  if (!availability.available) {
    throw new ApiError("CONFLICT", availability.message, {
      slug: [availability.message],
    });
  }

  try {
    const biolink = await prisma.$transaction(async (tx) => {
      const created = await tx.biolink.create({
        data: {
          ownerId: user.id,
          slug: input.slug,
          title: input.title ?? user.username,
          description: input.description,
          themeConfig: defaultThemeConfig() as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, slug: true, title: true, createdAt: true },
      });

      // Une page vide n'est pas exploitable : on l'amorce avec les blocks
      // qu'elle aurait de toute façon. L'utilisateur arrive sur quelque chose
      // qui ressemble déjà à une page, pas sur un canevas blanc.
      await tx.block.createMany({
        data: [
          { biolinkId: created.id, type: "avatar", config: defaultBlockConfig("avatar") as Prisma.InputJsonValue, position: 0 },
          { biolinkId: created.id, type: "badges", config: defaultBlockConfig("badges") as Prisma.InputJsonValue, position: 1 },
          { biolinkId: created.id, type: "header", config: defaultBlockConfig("header") as Prisma.InputJsonValue, position: 2 },
          { biolinkId: created.id, type: "socials", config: defaultBlockConfig("socials") as Prisma.InputJsonValue, position: 3 },
          { biolinkId: created.id, type: "links", config: defaultBlockConfig("links") as Prisma.InputJsonValue, position: 4 },
        ],
      });

      return created;
    });

    return ok({ biolink }, 201);
  } catch (error) {
    // Le trigger Postgres a gagné la course contre notre `count` : deux
    // créations simultanées, une seule passe.
    const quotaError = quotaErrorFromDatabase(error);
    if (quotaError) throw quotaError;

    // Le slug a été pris entre notre contrôle et l'insertion.
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
