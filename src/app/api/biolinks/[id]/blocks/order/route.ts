import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { reorderSchema } from "@/lib/schemas/biolink";

/**
 * PUT /api/biolinks/:id/blocks/order
 * Réordonne les blocks. Même contrat que pour les liens : ordre final complet.
 */
export const PUT = withErrorHandling(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;

    await enforce("mutation", `order:${user.id}`);

    const biolink = await requireOwnedBiolinkRef(user, id);
    const input = await parseBody(request, reorderSchema);

    const existing = await prisma.block.findMany({
      where: { biolinkId: id },
      select: { id: true },
    });

    const owned = new Set(existing.map((block) => block.id));

    if (input.ids.some((blockId) => !owned.has(blockId))) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "La liste contient des blocks qui n'appartiennent pas à cette page."
      );
    }

    if (input.ids.length !== existing.length) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `La liste doit contenir vos ${existing.length} blocks, ${input.ids.length} fourni(s).`
      );
    }

    await prisma.$transaction(
      input.ids.map((blockId, position) =>
        prisma.block.update({ where: { id: blockId }, data: { position } })
      )
    );

    await invalidatePageCache(biolink.slug);

    return ok({ order: input.ids, message: "Ordre enregistré." });
  }
);
