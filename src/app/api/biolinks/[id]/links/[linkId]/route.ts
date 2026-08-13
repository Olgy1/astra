import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { updateLinkSchema } from "@/lib/schemas/biolink";

type Context = { params: Promise<{ id: string; linkId: string }> };

/**
 * Charge un lien en vérifiant qu'il appartient bien au biolink demandé.
 *
 * Le contrôle `biolinkId` n'est pas redondant avec la propriété du biolink :
 * sans lui, quelqu'un pourrait passer l'identifiant de SA page et l'id d'un
 * lien appartenant à quelqu'un d'autre. La propriété serait validée sur la
 * page, et la mutation appliquée au lien du tiers.
 */
async function requireLink(biolinkId: string, linkId: string) {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: { id: true, biolinkId: true },
  });

  if (!link || link.biolinkId !== biolinkId) {
    throw new ApiError("NOT_FOUND", "Ce lien est introuvable.");
  }

  return link;
}

/**
 * PATCH /api/biolinks/:id/links/:linkId
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id, linkId } = await context.params;

  await enforce("mutation", `links:${user.id}`);

  const biolink = await requireOwnedBiolinkRef(user, id);
  await requireLink(id, linkId);

  const input = await parseBody(request, updateLinkSchema);

  const data: Prisma.LinkUpdateInput = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.url !== undefined) data.url = input.url;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;

  const link = await prisma.link.update({ where: { id: linkId }, data });

  await invalidatePageCache(biolink.slug);

  return ok({ link });
});

/**
 * DELETE /api/biolinks/:id/links/:linkId
 */
export const DELETE = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id, linkId } = await context.params;

  const biolink = await requireOwnedBiolinkRef(user, id);
  await requireLink(id, linkId);

  await prisma.link.delete({ where: { id: linkId } });

  // Les positions ne sont pas recalculées : elles servent uniquement à
  // ordonner, pas à indexer. Une suite 0,1,3 trie exactement comme 0,1,2, et
  // renuméroter coûterait une écriture par lien restant à chaque suppression.
  await invalidatePageCache(biolink.slug);

  return ok({ message: "Lien supprimé." });
});
