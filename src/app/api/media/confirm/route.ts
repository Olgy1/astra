import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { isS3Storage, serverEnv } from "@/lib/env";
import { registerMediaAsset } from "@/lib/media";
import { MEDIA_CONSTRAINTS, s3Client, s3PublicUrl } from "@/lib/s3";
import { confirmMediaSchema } from "@/lib/schemas/biolink";

/**
 * POST /api/media/confirm
 *
 * Enregistre l'asset après un upload réussi via le CDN (gros fichiers).
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
    throw new ApiError("BAD_REQUEST", "Ce serveur utilise l'upload direct, pas le flux via CDN.");
  }

  // Interrogation de l'objet via une URL HEAD présignée et un fetch brut,
  // plutôt que HeadObjectCommand du SDK : Backblaze B2 renvoie ses erreurs
  // (XML) sur les HEAD, que la désérialisation du SDK traduit en opaque
  // `UnknownError`. Un fetch direct expose le vrai statut et les en-têtes.
  let headStatus = 0;
  let headContentLength = 0;
  let headContentType = "";
  try {
    const headUrl = await getSignedUrl(
      s3Client(),
      new HeadObjectCommand({ Bucket: serverEnv().S3_BUCKET!, Key: input.key }),
      { expiresIn: 120 }
    );
    const head = await fetch(headUrl, { method: "HEAD" });
    headStatus = head.status;
    headContentLength = Number(head.headers.get("content-length") ?? 0);
    headContentType = head.headers.get("content-type") ?? "";
  } catch {
    throw new ApiError(
      "INTERNAL_ERROR",
      "Impossible de vérifier le fichier sur le stockage. Réessayez dans un instant."
    );
  }

  if (headStatus === 404) {
    throw new ApiError(
      "NOT_FOUND",
      "Ce fichier est introuvable sur le stockage. L'upload a peut-être échoué : réessayez."
    );
  }

  if (headStatus !== 200) {
    // 403 sur Backblaze = quota de téléchargement (Class B) dépassé, la
    // plupart du temps. C'est un plafond journalier du plan gratuit : les
    // médias redeviennent lisibles après réinitialisation.
    throw new ApiError(
      "INTERNAL_ERROR",
      headStatus === 403
        ? "Le stockage refuse la lecture pour l'instant (quota de téléchargement B2 du jour dépassé). Les médias seront de nouveau accessibles après la réinitialisation quotidienne ; l'upload lui-même a réussi."
        : `Le stockage n'a pas confirmé le fichier (HTTP ${headStatus}).`
    );
  }

  const sizeBytes = headContentLength;
  const mimeType = headContentType || "application/octet-stream";
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
  // une erreur de contrainte unique sur `key`. La purge des anciens médias
  // du même type et l'invalidation du cache sont faites par le helper à la
  // création (une retentative retombe sur l'update, la purge a déjà eu lieu).
  const existing = await prisma.mediaAsset.findUnique({ where: { key: input.key } });

  const asset = existing
    ? await prisma.mediaAsset.update({
        where: { key: input.key },
        data: { biolinkId: input.biolinkId, type: input.type },
        select: { id: true, type: true, url: true, key: true, sizeBytes: true, createdAt: true },
      })
    : await registerMediaAsset({
        ownerId: user.id,
        biolinkId: input.biolinkId,
        type: input.type,
        key: input.key,
        url: s3PublicUrl(input.key),
        mimeType,
        sizeBytes,
      });

  return ok({ asset }, 201);
});
