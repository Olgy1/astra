import { z } from "zod";
import { ok, parseQuery, withErrorHandling } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/context";
import { MEDIA_CONSTRAINTS } from "@/lib/s3";

const querySchema = z.object({
  type: z.enum(["AVATAR", "BANNER", "AUDIO", "CURSOR", "BACKGROUND", "FONT"]).optional(),
  biolinkId: z.string().uuid().optional(),
});

/**
 * GET /api/media
 * Médias de l'utilisateur, filtrables. Alimente la bibliothèque de l'éditeur.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  const query = parseQuery(request, querySchema);

  // `ownerId` est imposé, jamais lu depuis la requête : c'est ce qui empêche
  // de lister les médias d'un autre compte en passant son identifiant.
  const assets = await prisma.mediaAsset.findMany({
    where: {
      ownerId: user.id,
      ...(query.type ? { type: query.type } : {}),
      ...(query.biolinkId ? { biolinkId: query.biolinkId } : {}),
    },
    select: {
      id: true,
      type: true,
      url: true,
      key: true,
      mimeType: true,
      sizeBytes: true,
      biolinkId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalBytes = assets.reduce((sum, asset) => sum + asset.sizeBytes, 0);

  return ok({
    assets,
    storage: {
      totalBytes,
      totalMb: Math.round((totalBytes / 1024 / 1024) * 10) / 10,
      count: assets.length,
    },
    // Le client peut ainsi refuser un fichier trop lourd avant de l'envoyer,
    // sans dupliquer les limites côté front — où elles finiraient par diverger.
    constraints: Object.fromEntries(
      Object.entries(MEDIA_CONSTRAINTS).map(([type, constraint]) => [
        type,
        {
          maxBytes: constraint.maxBytes,
          maxMb: Math.round(constraint.maxBytes / 1024 / 1024),
          mimeTypes: constraint.mimeTypes,
          label: constraint.label,
        },
      ])
    ),
  });
});
