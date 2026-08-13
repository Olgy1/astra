import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireVerifiedUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { MEDIA_CONSTRAINTS, validateUpload } from "@/lib/s3";
import { deleteStoredObjects, storeFile } from "@/lib/storage";
import type { MediaType } from "@prisma/client";

/**
 * POST /api/media/upload  (multipart/form-data)
 *
 * Upload direct d'un média. Le fichier transite par le serveur, qui l'écrit
 * sur le stockage configuré (local ou S3). Alternative au flux présigné, qui
 * exige S3 : cet endpoint fonctionne dans les deux modes, et c'est le chemin
 * utilisé par l'éditeur.
 *
 * Champs du formulaire : `file`, `type`, et `biolinkId` optionnel.
 */

const MEDIA_TYPES: MediaType[] = ["AVATAR", "BANNER", "AUDIO", "CURSOR", "BACKGROUND", "FONT"];

// Plafond dur, quel que soit le type : un multipart au-delà se fait refuser
// avant même de lire le corps, pour ne pas encaisser un flux illimité. Aligné
// sur la plus grande contrainte (fond vidéo 4K), plus une marge pour l'entête
// multipart.
const MAX_UPLOAD_BYTES = 260 * 1024 * 1024;

export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireVerifiedUser();

  // Par compte ET par IP : le quota protège le stockage, et un attaquant
  // change d'IP plus facilement que de compte vérifié.
  await enforce("upload", `user:${user.id}`);
  await enforce("upload", `ip:${clientIp(request)}`);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Fichier trop volumineux.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError("BAD_REQUEST", "Requête d'upload invalide.");
  }

  const file = form.get("file");
  const rawType = String(form.get("type") ?? "");
  const biolinkId = form.get("biolinkId") ? String(form.get("biolinkId")) : undefined;

  if (!(file instanceof File)) {
    throw new ApiError("BAD_REQUEST", "Aucun fichier fourni.");
  }

  if (!MEDIA_TYPES.includes(rawType as MediaType)) {
    throw new ApiError("VALIDATION_ERROR", "Type de média invalide.");
  }
  const type = rawType as MediaType;

  if (biolinkId) {
    await requireOwnedBiolinkRef(user, biolinkId);
  }

  // Validation sur le type MIME et la taille réels du fichier reçu, pas sur
  // ce que le client déclare. Liste blanche stricte : le SVG est exclu de
  // tous les types image (vecteur XSS).
  const validation = validateUpload(type, file.type, file.size);
  if (!validation.ok) {
    throw new ApiError(
      validation.reason === "TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
      validation.message
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Double contrôle de taille sur le buffer réellement lu : `file.size` est
  // déclaré par le client, `buffer.length` est ce qu'on a effectivement reçu.
  if (buffer.length > MEDIA_CONSTRAINTS[type].maxBytes) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Fichier trop volumineux.");
  }

  const stored = await storeFile(user.id, type, buffer, file.type);

  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId: user.id,
      biolinkId,
      type,
      key: stored.key,
      url: stored.url,
      mimeType: file.type,
      sizeBytes: stored.sizeBytes,
    },
    select: { id: true, type: true, url: true, key: true, sizeBytes: true, createdAt: true },
  });

  if (biolinkId) {
    // Un seul média par type et par page : le nouvel upload REMPLACE
    // l'ancien. Sans cette purge, un avatar recadré laissait en base l'image
    // d'origine, et la page publique — qui prend le premier média du type —
    // continuait d'afficher l'ancienne image au lieu du recadrage.
    const previous = await prisma.mediaAsset.findMany({
      where: { biolinkId, type, id: { not: asset.id } },
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

    const biolink = await prisma.biolink.findUnique({
      where: { id: biolinkId },
      select: { slug: true },
    });
    if (biolink) await invalidatePageCache(biolink.slug);
  }

  return ok({ asset }, 201);
});
