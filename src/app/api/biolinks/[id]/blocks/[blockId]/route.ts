import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { updateBlockSchema } from "@/lib/schemas/biolink";
import { validateBlockConfig } from "@/lib/blocks/registry";

type Context = { params: Promise<{ id: string; blockId: string }> };

/** Même raison que pour les liens : l'id du block doit appartenir à CE biolink. */
async function requireBlock(biolinkId: string, blockId: string) {
  const block = await prisma.block.findUnique({
    where: { id: blockId },
    select: { id: true, biolinkId: true, type: true },
  });

  if (!block || block.biolinkId !== biolinkId) {
    throw new ApiError("NOT_FOUND", "Ce block est introuvable.");
  }

  return block;
}

/**
 * PATCH /api/biolinks/:id/blocks/:blockId
 * Met à jour la configuration du block, validée par le schéma de son type.
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id, blockId } = await context.params;

  await enforce("mutation", `blocks:${user.id}`);

  const biolink = await requireOwnedBiolinkRef(user, id);
  const block = await requireBlock(id, blockId);
  const input = await parseBody(request, updateBlockSchema);

  const data: Prisma.BlockUpdateInput = {};

  if (input.config !== undefined) {
    // Le type vient de la base, pas de la requête : sans ça, on pourrait
    // faire valider une config de « text » contre le schéma de « spotify »
    // en mentant sur le type, et stocker n'importe quoi.
    data.config = validateBlockConfig(block.type, input.config) as Prisma.InputJsonValue;
  }

  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;

  const updated = await prisma.block.update({ where: { id: blockId }, data });

  await invalidatePageCache(biolink.slug);

  return ok({ block: updated });
});

/**
 * DELETE /api/biolinks/:id/blocks/:blockId
 */
export const DELETE = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id, blockId } = await context.params;

  const biolink = await requireOwnedBiolinkRef(user, id);
  await requireBlock(id, blockId);

  await prisma.block.delete({ where: { id: blockId } });
  await invalidatePageCache(biolink.slug);

  return ok({ message: "Block supprimé." });
});
