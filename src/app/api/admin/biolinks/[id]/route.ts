import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { invalidatePageCache } from "@/lib/redis";
import { deleteStoredObjects } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Aucune modification fournie.");

/**
 * PATCH /api/admin/biolinks/:id
 * Modération : dépublication forcée sur n'importe quelle page.
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, patchSchema);

  const biolink = await prisma.biolink.findUnique({
    where: { id },
    select: { id: true, slug: true, ownerId: true, isPublished: true },
  });

  if (!biolink) throw new ApiError("NOT_FOUND", "Cette page est introuvable.");

  const updated = await prisma.biolink.update({
    where: { id },
    data: {
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
    select: { id: true, slug: true, isPublished: true },
  });

  await invalidatePageCache(biolink.slug);

  await writeAdminLog({
    admin,
    action: "biolink.moderate",
    targetType: "biolink",
    targetId: biolink.id,
    metadata: {
      slug: biolink.slug,
      ownerId: biolink.ownerId,
      changes: input,
    },
    ip: clientIp(request),
  });

  return ok({ biolink: updated });
});

/**
 * DELETE /api/admin/biolinks/:id
 * Supprime n'importe quelle page, ses liens, blocks, et médias S3.
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const biolink = await prisma.biolink.findUnique({
    where: { id },
    select: { id: true, slug: true, ownerId: true },
  });

  if (!biolink) throw new ApiError("NOT_FOUND", "Cette page est introuvable.");

  const assets = await prisma.mediaAsset.findMany({
    where: { biolinkId: id },
    select: { key: true },
  });

  await prisma.biolink.delete({ where: { id } });
  await invalidatePageCache(biolink.slug);

  if (assets.length > 0) {
    try {
      await deleteStoredObjects(assets.map((asset) => asset.key));
    } catch (error) {
      console.error("[admin] purge S3 incomplète :", error);
    }
  }

  await writeAdminLog({
    admin,
    action: "biolink.delete",
    targetType: "biolink",
    targetId: biolink.id,
    metadata: { slug: biolink.slug, ownerId: biolink.ownerId, deletedAssets: assets.length },
    ip: clientIp(request),
  });

  return ok({
    message: `La page astra.is-a.dev/${biolink.slug} a été supprimée.`,
    deletedAssets: assets.length,
  });
});
