import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { reorderSchema } from "@/lib/schemas/biolink";

/**
 * PUT /api/biolinks/:id/links/order
 *
 * Réordonne les liens. Prend la liste complète des identifiants dans leur
 * ordre final, et non un delta : voir `reorderSchema` pour le pourquoi.
 */
export const PUT = withErrorHandling(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;

    await enforce("mutation", `order:${user.id}`);

    const biolink = await requireOwnedBiolinkRef(user, id);
    const input = await parseBody(request, reorderSchema);

    const existing = await prisma.link.findMany({
      where: { biolinkId: id },
      select: { id: true },
    });

    const owned = new Set(existing.map((link) => link.id));

    // La liste doit correspondre exactement aux liens de cette page. Un id
    // étranger appartiendrait à quelqu'un d'autre ; un id manquant laisserait
    // ce lien à son ancienne position, avec un ordre final imprévisible.
    const unknown = input.ids.filter((linkId) => !owned.has(linkId));
    if (unknown.length > 0) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "La liste contient des liens qui n'appartiennent pas à cette page."
      );
    }

    if (input.ids.length !== existing.length) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `La liste doit contenir vos ${existing.length} liens, ${input.ids.length} fourni(s).`
      );
    }

    // Transaction : un réordonnancement à moitié appliqué laisserait deux
    // liens à la même position, donc un ordre d'affichage arbitraire.
    await prisma.$transaction(
      input.ids.map((linkId, position) =>
        prisma.link.update({ where: { id: linkId }, data: { position } })
      )
    );

    await invalidatePageCache(biolink.slug);

    return ok({ order: input.ids, message: "Ordre enregistré." });
  }
);
