import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { serverEnv, isS3Storage } from "@/lib/env";
import { MEDIA_CONSTRAINTS, s3Client, s3PublicUrl } from "@/lib/s3";
import { confirmMediaSchema } from "@/lib/schemas/biolink";

/**
 * POST /api/media/confirm
 *
 * Enregistre l'asset après un upload réussi.
 *
 * On interroge S3 (HeadObject) pour vérifier que l'objet existe vraiment et
 * relever sa taille réelle. Faire confiance au client sur ce point
 * permettrait d'inscrire en base des médias qui n'ont jamais été téléversés,
 * et de fausser tout quota de stockage bâti dessus.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireVerifiedUser();
  const input = await parseBody(request, confirmMediaSchema);

  // La clé est construite par le serveur au presign sous la forme
  // `u/{ownerId}/...`. Ce contrôle empêche de confirmer la clé d'un autre
  // compte, et donc de rattacher son avatar à sa propre page.
  if (!input.key.startsWith(`u/${user.id}/`)) {
    throw new ApiError("FORBIDDEN", "Cette clé de fichier ne vous appartient pas.");
  }

  if (input.biolinkId) {
    await requireOwnedBiolinkRef(user, input.biolinkId);
  }

  // Ce flux (presign + confirm) est propre à S3. En stockage local, l'éditeur
  // passe par /api/media/upload, qui n'a pas d'étape de confirmation.
  if (!isS3Storage()) {
    throw new ApiError("BAD_REQUEST", "Ce serveur utilise l'upload direct, pas le flux présigné.");
  }

  let head;

  try {
    head = await s3Client().send(
      new HeadObjectCommand({ Bucket: serverEnv().S3_BUCKET!, Key: input.key })
    );
  } catch {
    throw new ApiError(
      "NOT_FOUND",
      "Ce fichier est introuvable sur le stockage. L'upload a peut-être échoué : réessayez."
    );
  }

  const sizeBytes = head.ContentLength ?? 0;
  const mimeType = head.ContentType ?? "application/octet-stream";
  const constraint = MEDIA_CONSTRAINTS[input.type];

  // Deuxième contrôle, sur les valeurs réelles cette fois. La signature S3
  // les impose déjà, mais un bucket mal configuré (signature non exigée)
  // rendrait le premier contrôle inopérant sans que rien ne le signale.
  if (sizeBytes > constraint.maxBytes) {
    throw new ApiError(
      "PAYLOAD_TOO_LARGE",
      `Fichier trop volumineux pour « ${constraint.label} ».`
    );
  }

  if (!constraint.mimeTypes.includes(mimeType)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Format non accepté pour « ${constraint.label} » : ${mimeType}.`
    );
  }

  // upsert : réessayer une confirmation ne doit pas produire un doublon ni
  // une erreur de contrainte unique sur `key`.
  const asset = await prisma.mediaAsset.upsert({
    where: { key: input.key },
    create: {
      ownerId: user.id,
      biolinkId: input.biolinkId,
      type: input.type,
      key: input.key,
      url: s3PublicUrl(input.key),
      mimeType,
      sizeBytes,
    },
    update: { biolinkId: input.biolinkId, type: input.type },
    select: { id: true, type: true, url: true, key: true, sizeBytes: true, createdAt: true },
  });

  if (input.biolinkId) {
    const biolink = await prisma.biolink.findUnique({
      where: { id: input.biolinkId },
      select: { slug: true },
    });
    if (biolink) await invalidatePageCache(biolink.slug);
  }

  return ok({ asset }, 201);
});
