import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolink } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { parseThemeConfig } from "@/lib/schemas/theme";
import { updateBiolinkSchema } from "@/lib/schemas/biolink";
import { deleteStoredObjects } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/biolinks/:id
 * Page complète : thème, liens, blocks, médias. Alimente l'éditeur.
 */
export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await requireOwnedBiolink(user, id);

  const biolink = await prisma.biolink.findUnique({
    where: { id },
    include: {
      links: { orderBy: { position: "asc" } },
      blocks: { orderBy: { position: "asc" } },
      mediaAssets: {
        select: { id: true, type: true, url: true, key: true, sizeBytes: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!biolink) throw new ApiError("NOT_FOUND", "Cette page est introuvable.");

  // `passwordHash` ne sort jamais de la base, même vers le propriétaire :
  // il n'a aucun usage côté client, et un champ qu'on n'expose pas est un
  // champ qui ne peut pas fuiter.
  const { passwordHash: _ignored, ...safe } = biolink;

  return ok({
    biolink: {
      ...safe,
      // Reparse à la lecture : une config écrite par une version antérieure
      // du schéma est complétée par les défauts au lieu de casser l'éditeur.
      themeConfig: parseThemeConfig(biolink.themeConfig),
    },
  });
});

/**
 * PATCH /api/biolinks/:id
 * Met à jour titre, description, thème, SEO, publication.
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await enforce("mutation", `biolink:${user.id}`);

  const existing = await requireOwnedBiolink(user, id);
  const input = await parseBody(request, updateBiolinkSchema);

  // Publier expose la page au public : on exige l'email vérifié ici, et pas
  // seulement à la création. Sans ce contrôle, il suffirait de créer avant
  // vérification puis de publier plus tard.
  if (input.isPublished === true && !user.emailVerified) {
    throw new ApiError(
      "EMAIL_NOT_VERIFIED",
      "Confirmez votre adresse email pour publier votre page."
    );
  }

  // Suspension de modération : tant qu'elle est active, l'auteur ne peut ni
  // dépublier ni republier. Sinon, dépublier puis republier effacerait
  // l'écran « page suspendue » sans corriger le motif. Le contenu reste
  // modifiable — c'est précisément ce que la suspension attend.
  if (
    input.isPublished !== undefined &&
    existing.suspendedUntil &&
    existing.suspendedUntil > new Date()
  ) {
    throw new ApiError(
      "FORBIDDEN",
      "Cette page est suspendue par la modération : la publication est verrouillée jusqu'à la fin de la suspension. Vous pouvez modifier le contenu pour corriger le motif."
    );
  }

  const data: Prisma.BiolinkUpdateInput = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.isPublished !== undefined) data.isPublished = input.isPublished;
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
  if (input.ogImageUrl !== undefined) data.ogImageUrl = input.ogImageUrl;
  if (input.themeConfig !== undefined) {
    data.themeConfig = input.themeConfig as unknown as Prisma.InputJsonValue;
  }

  const biolink = await prisma.biolink.update({
    where: { id },
    data,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isPublished: true,
      seoTitle: true,
      seoDescription: true,
      ogImageUrl: true,
      themeConfig: true,
      updatedAt: true,
    },
  });

  await invalidatePageCache(existing.slug);

  return ok({ biolink: { ...biolink, themeConfig: parseThemeConfig(biolink.themeConfig) } });
});

/**
 * DELETE /api/biolinks/:id
 * Supprime la page, ses liens, ses blocks, et ses médias sur S3.
 */
export const DELETE = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const biolink = await requireOwnedBiolink(user, id);

  const assets = await prisma.mediaAsset.findMany({
    where: { biolinkId: id },
    select: { key: true },
  });

  // La base d'abord, S3 ensuite. Dans l'ordre inverse, un échec de la
  // suppression en base laisserait une page qui référence des fichiers
  // disparus — donc une page cassée. Ici, le pire cas est un objet orphelin
  // sur S3, invisible et rattrapable par un nettoyage périodique.
  await prisma.biolink.delete({ where: { id } });
  await invalidatePageCache(biolink.slug);

  if (assets.length > 0) {
    try {
      await deleteStoredObjects(assets.map((asset) => asset.key));
    } catch (error) {
      console.error("[biolinks] purge S3 incomplète :", error);
    }
  }

  return ok({
    message: `La page astra.is-a.dev/${biolink.slug} a été supprimée.`,
    deletedAssets: assets.length,
  });
});
