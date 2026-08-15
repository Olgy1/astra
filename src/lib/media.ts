import { prisma } from "@/lib/db";
import { invalidatePageCache } from "@/lib/redis";
import { deleteStoredObjects } from "@/lib/storage";
import type { MediaType } from "@prisma/client";

export type MediaAssetInput = {
  ownerId: string;
  biolinkId?: string;
  type: MediaType;
  key: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Enregistre un asset média en base, puis nettoie autour :
 *  - purge des anciens médias du même type (sauf AUDIO, multi-pistes) ;
 *  - invalidation du cache Redis de la page pour refléter le changement.
 *
 * Partagé entre l'upload serveur (petits fichiers) et la confirmation de
 * l'upload via le CDN (gros fichiers) : le comportement reste identique quel
 * que soit le chemin d'arrivée.
 */
export async function registerMediaAsset(input: MediaAssetInput) {
  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId: input.ownerId,
      biolinkId: input.biolinkId,
      type: input.type,
      key: input.key,
      url: input.url,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
    select: { id: true, type: true, url: true, key: true, sizeBytes: true, createdAt: true },
  });

  if (input.biolinkId) {
    // AUDIO est multi-valeurs : une page peut porter plusieurs pistes, donc
    // plusieurs fichiers audio (une URL par piste). La purge « un seul média
    // par type » supprimerait la piste 1 quand on uploade la piste 2 — exactement
    // le bug « la première piste ne marche plus ». Les autres types restent
    // mono-valeurs (avatar, bannière, fond, curseur, police) et gardent la
    // purge : un avatar recadré remplace l'ancien au lieu de laisser la page
    // afficher l'image d'origine.
    if (input.type !== "AUDIO") {
      const previous = await prisma.mediaAsset.findMany({
        where: { biolinkId: input.biolinkId, type: input.type, id: { not: asset.id } },
        select: { id: true, key: true },
      });

      if (previous.length > 0) {
        await prisma.mediaAsset.deleteMany({
          where: { id: { in: previous.map((entry) => entry.id) } },
        });

        // Le fichier d'abord supprimé en base, le stockage ensuite : le pire
        // cas est un objet orphelin invisible, pas une page qui référence un
        // fichier disparu. Un échec ici ne doit pas faire échouer l'upload.
        try {
          await deleteStoredObjects(previous.map((entry) => entry.key));
        } catch (error) {
          console.error("[media] purge de l'ancien média incomplète :", error);
        }
      }
    }

    const biolink = await prisma.biolink.findUnique({
      where: { id: input.biolinkId },
      select: { slug: true },
    });
    if (biolink) await invalidatePageCache(biolink.slug);
  }

  return asset;
}
