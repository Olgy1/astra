import { clientIp, ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { isS3Storage, serverEnv } from "@/lib/env";
import { requireVerifiedUser } from "@/lib/auth/context";
import { requireOwnedBiolinkRef } from "@/lib/biolinks/access";
import { createPresignedUpload, validateUpload } from "@/lib/s3";
import { presignSchema } from "@/lib/schemas/biolink";

/**
 * POST /api/media/presign
 *
 * Prépare l'upload d'un GROS fichier (vidéo de fond, > ~4,5 Mo) qui ne peut
 * pas passer par la route multipart : la plateforme d'hébergement (Vercel)
 * refuse les bodies au-delà de cette taille.
 *
 * Le navigateur envoie alors le fichier à la fonction Cloudflare Pages du
 * CDN médias (`https://<cdn>/upload?url=…`), qui le transfère vers l'URL S3
 * présignée en serveur-à-serveur. Le navigateur ne touche jamais le bucket :
 * aucun CORS à configurer sur B2, et les clés B2 ne quittent pas le serveur.
 *
 * Le contrôle du type MIME et de la taille se fait ICI, avant la signature :
 * `ContentType` est inclus dans la signature, donc S3 rejette tout upload qui
 * ne correspond pas à ce qui a été déclaré.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireVerifiedUser();

  // Le flux via CDN exige S3. En stockage local, on le signale au client
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

  // Le flux CDN ne passe pas par la limite de body de Vercel : on borne par
  // le plafond de la fonction Cloudflare (95 Mo), quel que soit le type de
  // média. La liste blanche MIME du type reste appliquée.
  const validation = validateUpload(
    input.type,
    input.mimeType,
    input.sizeBytes,
    CDN_MAX_UPLOAD_BYTES
  );

  if (!validation.ok) {
    throw new ApiError(
      validation.reason === "TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
      validation.message
    );
  }

  // L'URL d'upload du CDN dérive de S3_PUBLIC_URL (ex. https://media.astraa.is-cool.dev).
  const cdnBase = (serverEnv().S3_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (!cdnBase) {
    throw new ApiError(
      "INTERNAL_ERROR",
      "Le CDN médias n'est pas configuré (S3_PUBLIC_URL manquant) : impossible d'uploader ce fichier."
    );
  }

  const presigned = await createPresignedUpload(
    user.id,
    input.type,
    input.mimeType,
    input.sizeBytes
  );

  return ok({
    // Le client envoie le fichier à la fonction du CDN, qui transfère vers
    // l'URL présignée B2 (paramètre `url`) en serveur-à-serveur.
    uploadUrl: `${cdnBase}/upload?url=${encodeURIComponent(presigned.uploadUrl)}`,
    key: presigned.key,
    // Le client doit renvoyer exactement cet en-tête, sinon la signature ne
    // correspond plus et S3 refuse.
    requiredHeaders: { "Content-Type": input.mimeType },
  });
});

/** Plafond d'upload via la fonction Cloudflare (100 Mo Workers, marge incluse). */
const CDN_MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
