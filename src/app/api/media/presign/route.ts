import { clientIp, ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { isS3Storage } from "@/lib/env";
import { requireVerifiedUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { createPresignedUpload, validateUpload } from "@/lib/s3";
import { presignSchema } from "@/lib/schemas/biolink";

/**
 * POST /api/media/presign
 *
 * Renvoie une URL S3 présignée pour un PUT direct depuis le navigateur.
 * Le fichier ne transite pas par le serveur Next.js.
 *
 * Le contrôle du type MIME et de la taille se fait ICI, avant la signature :
 * `ContentType` et `ContentLength` sont inclus dans la signature, donc S3
 * rejette tout upload qui ne correspond pas à ce qui a été déclaré. Valider
 * après coup laisserait la porte ouverte le temps de l'upload.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireVerifiedUser();

  // L'upload présigné exige S3. En stockage local, on le signale au client
  // (qui retombera sur POST /api/media/upload) plutôt que de renvoyer une
  // erreur : le choix du flux appartient au client, pas au moment de la
  // requête.
  if (!isS3Storage()) {
    return ok({ presigned: false as const });
  }

  // Par compte et non par IP : le quota protège notre facture S3, et un
  // attaquant change d'IP plus facilement que de compte vérifié.
  await enforce("upload", `user:${user.id}`);
  await enforce("upload", `ip:${clientIp(request)}`);

  const input = await parseBody(request, presignSchema);

  if (input.biolinkId) {
    await requireOwnedBiolinkRef(user, input.biolinkId);
  }

  const validation = validateUpload(input.type, input.mimeType, input.sizeBytes);

  if (!validation.ok) {
    throw new ApiError(
      validation.reason === "TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
      validation.message
    );
  }

  const presigned = await createPresignedUpload(
    user.id,
    input.type,
    input.mimeType,
    input.sizeBytes
  );

  return ok({
    uploadUrl: presigned.uploadUrl,
    key: presigned.key,
    publicUrl: presigned.publicUrl,
    expiresInSeconds: presigned.expiresInSeconds,
    // Le client doit renvoyer exactement cet en-tête, sinon la signature ne
    // correspond plus et S3 refuse.
    requiredHeaders: { "Content-Type": input.mimeType },
  });
});
