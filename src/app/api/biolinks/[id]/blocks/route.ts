import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { nextPosition, requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { createBlockSchema } from "@/lib/schemas/biolink";
import {
  assertBlockAllowed,
  assertUnderInstanceLimit,
  defaultBlockConfig,
  validateBlockConfig,
} from "@/lib/blocks/registry";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/biolinks/:id/blocks
 */
export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await requireOwnedBiolinkRef(user, id);

  const blocks = await prisma.block.findMany({
    where: { biolinkId: id },
    orderBy: { position: "asc" },
  });

  return ok({ blocks });
});

/**
 * POST /api/biolinks/:id/blocks
 * Ajoute un block. Le type et la config sont validés contre le registry.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await enforce("mutation", `blocks:${user.id}`);

  const biolink = await requireOwnedBiolinkRef(user, id);
  const input = await parseBody(request, createBlockSchema);

  assertBlockAllowed(input.type, user.role === "ADMIN");

  // La limite d'instances est comptée puis vérifiée hors transaction : deux
  // ajouts simultanés du même block pourraient donc passer tous les deux.
  // C'est un défaut cosmétique assumé — deux avatars sur une page, que
  // l'utilisateur corrige en supprimant l'un des deux. Le verrou qu'il
  // faudrait poser pour l'éviter coûterait plus cher que le problème.
  const count = await prisma.block.count({ where: { biolinkId: id, type: input.type } });
  assertUnderInstanceLimit(input.type, count);

  const config =
    input.config === undefined
      ? defaultBlockConfig(input.type)
      : validateBlockConfig(input.type, input.config);

  const block = await prisma.block.create({
    data: {
      biolinkId: id,
      type: input.type,
      config: config as Prisma.InputJsonValue,
      position: await nextPosition("block", id),
    },
  });

  await invalidatePageCache(biolink.slug);

  return ok({ block }, 201);
});
