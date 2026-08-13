import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { nextPosition, requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { createLinkSchema } from "@/lib/schemas/biolink";

type Context = { params: Promise<{ id: string }> };

/** Un garde-fou, pas une offre commerciale : au-delà, la page est illisible. */
const MAX_LINKS_PER_BIOLINK = 100;

/**
 * GET /api/biolinks/:id/links
 */
export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await requireOwnedBiolinkRef(user, id);

  const links = await prisma.link.findMany({
    where: { biolinkId: id },
    orderBy: { position: "asc" },
  });

  return ok({ links });
});

/**
 * POST /api/biolinks/:id/links
 * Ajoute un lien en fin de liste.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await enforce("mutation", `links:${user.id}`);

  const biolink = await requireOwnedBiolinkRef(user, id);
  const input = await parseBody(request, createLinkSchema);

  const count = await prisma.link.count({ where: { biolinkId: id } });

  if (count >= MAX_LINKS_PER_BIOLINK) {
    throw new ApiError(
      "CONFLICT",
      `Vous avez atteint la limite de ${MAX_LINKS_PER_BIOLINK} liens sur cette page.`
    );
  }

  const link = await prisma.link.create({
    data: {
      biolinkId: id,
      label: input.label,
      url: input.url,
      icon: input.icon,
      position: await nextPosition("link", id),
    },
  });

  await invalidatePageCache(biolink.slug);

  return ok({ link }, 201);
});
