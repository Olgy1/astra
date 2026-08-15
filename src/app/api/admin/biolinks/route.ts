import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, parseQuery, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { checkSlugAvailability } from "@/lib/schemas/slug";
import { createBiolinkSchema } from "@/lib/schemas/biolink";
import { defaultThemeConfig } from "@/lib/schemas/theme";
import { defaultBlockConfig } from "@/lib/blocks/registry";

const querySchema = z.object({
  q: z.string().trim().max(64).optional(),
  published: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/admin/biolinks?q=&published=&page=
 * Recherche parmi toutes les pages de la plateforme, quel que soit le
 * propriétaire. `q` cherche dans le slug et le titre.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await requireAdmin();
  const query = parseQuery(request, querySchema);

  const where: Prisma.BiolinkWhereInput = {};

  if (query.q) {
    where.OR = [
      { slug: { contains: query.q, mode: "insensitive" } },
      { title: { contains: query.q, mode: "insensitive" } },
    ];
  }

  if (query.published) where.isPublished = query.published === "true";

  const [total, biolinks] = await Promise.all([
    prisma.biolink.count({ where }),
    prisma.biolink.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        isPublished: true,
        isPasswordProtected: true,
        totalViews: true,
        uniqueViews: true,
        createdAt: true,
        owner: { select: { id: true, username: true } },
        _count: { select: { links: true, blocks: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    }),
  ]);

  return ok({
    biolinks,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / (query.pageSize ?? 20))),
    },
  });
});

/**
 * POST /api/admin/biolinks
 *
 * Crée une page pour un compte tiers (ou pour soi-même).
 *
 * C'est le seul chemin qui contourne le quota « 1 biolink par membre » : un
 * admin peut créer des pages pour d'autres comptes. Le contournement est
 * explicite et journalisé — c'est une capacité qui doit laisser une trace.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const admin = await requireAdmin();
  const ip = clientIp(request);

  const input = await parseBody(request, createBiolinkSchema.extend({ ownerUsername: z.string().trim().min(1).max(32) }));

  const owner = await prisma.user.findUnique({
    where: { usernameLower: input.ownerUsername.toLowerCase() },
    select: { id: true, username: true },
  });

  if (!owner) {
    throw new ApiError("NOT_FOUND", `Aucun compte avec le pseudo « ${input.ownerUsername} ».`);
  }

  const availability = await checkSlugAvailability(input.slug, { isAdmin: true });
  if (!availability.available) {
    throw new ApiError("CONFLICT", availability.message, { slug: [availability.message] });
  }

  try {
    const biolink = await prisma.$transaction(async (tx) => {
      const created = await tx.biolink.create({
        data: {
          ownerId: owner.id,
          slug: input.slug,
          title: input.title ?? owner.username,
          description: input.description,
          themeConfig: defaultThemeConfig() as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, slug: true, title: true, ownerId: true },
      });

      await tx.block.createMany({
        data: [
          { biolinkId: created.id, type: "avatar", config: defaultBlockConfig("avatar") as Prisma.InputJsonValue, position: 0 },
          { biolinkId: created.id, type: "header", config: defaultBlockConfig("header") as Prisma.InputJsonValue, position: 1 },
          { biolinkId: created.id, type: "socials", config: defaultBlockConfig("socials") as Prisma.InputJsonValue, position: 2 },
          { biolinkId: created.id, type: "links", config: defaultBlockConfig("links") as Prisma.InputJsonValue, position: 3 },
        ],
      });

      return created;
    });

    await writeAdminLog({
      admin,
      action: "biolink.create_for",
      targetType: "user",
      targetId: owner.id,
      metadata: {
        biolinkId: biolink.id,
        slug: biolink.slug,
        owner: owner.username,
        // La création pour un tiers contourne le quota membre : le motif est
        // enregistré (premium, support, migration) pour l'audit.
      },
      ip,
    });

    return ok({ biolink }, 201);
  } catch (error) {
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
