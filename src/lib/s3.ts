import { randomUUID } from "node:crypto";
import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/env";
import type { MediaType } from "@prisma/client";

/**
 * Stockage des médias (S3/Backblaze).
 *
 * Deux chemins d'écriture :
 *  - petit fichier : via le serveur (`s3PutObject`, route `/api/media/upload`) ;
 *  - gros fichier (vidéo de fond > ~4,5 Mo) : via la fonction Cloudflare
 *    Pages du CDN médias, qui transfère vers une URL présignée B2 en
 *    serveur-à-serveur — voir `createPresignedUpload` et
 *    `cloudflare/media-proxy/functions/upload.js`.
 *
 * Dans les deux cas le navigateur ne parle qu'à l'API du site ou au CDN,
 * jamais directement au bucket : aucun CORS à configurer sur B2.
 */

const globalForS3 = globalThis as unknown as { s3: S3Client | undefined };

function createClient(): S3Client {
  const env = serverEnv();
  // `!` : ce chemin n'est atteint qu'après `assertStorageConfigured()`, qui
  // garantit la présence de ces variables en mode S3.
  return new S3Client({
    region: env.S3_REGION!,
    endpoint: env.S3_ENDPOINT!,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Client S3 paresseux.
 *
 * Instancié au premier accès, pas au chargement du module : en stockage
 * local, les variables S3 sont absentes et créer le client échouerait. Ce
 * getter n'est appelé que par les fonctions S3, jamais en mode local.
 */
export function s3Client(): S3Client {
  if (!globalForS3.s3) {
    globalForS3.s3 = createClient();
  }
  return globalForS3.s3;
}

/**
 * Contraintes par type de média.
 *
 * Les types MIME sont une liste blanche, jamais une liste noire : c'est le
 * seul moyen d'empêcher l'upload de SVG (vecteur XSS via script embarqué) ou
 * de HTML servi depuis notre propre domaine.
 */
export const MEDIA_CONSTRAINTS: Record<
  MediaType,
  { maxBytes: number; mimeTypes: readonly string[]; label: string }
> = {
  AVATAR: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "Avatar",
  },
  BANNER: {
    maxBytes: 8 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "Bannière",
  },
  BACKGROUND: {
    // 256 Mo : de quoi accueillir une boucle vidéo de fond en 4K. La vidéo est
    // streamée au visiteur par segments (Range HTTP), donc sa taille n'impacte
    // pas le temps de démarrage — seul le débit compte.
    maxBytes: 256 * 1024 * 1024,
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ],
    label: "Arrière-plan",
  },
  AUDIO: {
    maxBytes: 12 * 1024 * 1024,
    // Liste large : les navigateurs rapportent le même fichier sous plusieurs
    // MIME selon l'extension (.mpa, .m4a, .aac…) ou la plateforme. Le client
    // déduit le type depuis le nom quand `File.type` est vide (voir
    // src/lib/media-types.ts).
    mimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/x-mpeg",
      "audio/x-mp3",
      "audio/ogg",
      "audio/wav",
      "audio/x-wav",
      "audio/webm",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
      "audio/flac",
    ],
    label: "Audio d'ambiance",
  },
  CURSOR: {
    maxBytes: 512 * 1024,
    // image/x-icon couvre les fichiers .cur/.ico, le format natif des
    // curseurs Windows — certains navigateurs ne rendent que ceux-là.
    mimeTypes: ["image/png", "image/gif", "image/webp", "image/x-icon"],
    label: "Curseur",
  },
  FONT: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["font/woff", "font/woff2", "font/ttf", "font/otf"],
    label: "Police",
  },
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/x-icon": "cur",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/x-mpeg": "mpa",
  "audio/x-mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "font/ttf": "ttf",
  "font/otf": "otf",
};

export type UploadValidationError =
  | { ok: false; reason: "MIME_NOT_ALLOWED"; message: string }
  | { ok: false; reason: "TOO_LARGE"; message: string };

export type UploadValidationResult = { ok: true } | UploadValidationError;

/** Valide type MIME et taille annoncés avant de signer l'URL. */
export function validateUpload(
  type: MediaType,
  mimeType: string,
  sizeBytes: number
): UploadValidationResult {
  const constraint = MEDIA_CONSTRAINTS[type];

  if (!constraint.mimeTypes.includes(mimeType)) {
    return {
      ok: false,
      reason: "MIME_NOT_ALLOWED",
      message: `Format non accepté pour « ${constraint.label} ». Formats autorisés : ${constraint.mimeTypes.join(", ")}.`,
    };
  }

  if (sizeBytes > constraint.maxBytes) {
    const maxMb = Math.round(constraint.maxBytes / 1024 / 1024);
    return {
      ok: false,
      reason: "TOO_LARGE",
      message: `Fichier trop volumineux pour « ${constraint.label} » : ${maxMb} Mo maximum.`,
    };
  }

  return { ok: true };
}

/**
 * Construit la clé S3. Le UUID rend la clé imprévisible et évite qu'un
 * réupload du même nom de fichier n'écrase l'ancien (les URL sont mises en
 * cache par le CDN).
 */
export function buildMediaKey(
  ownerId: string,
  type: MediaType,
  mimeType: string
): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? "bin";
  return `u/${ownerId}/${type.toLowerCase()}/${randomUUID()}.${extension}`;
}

/**
 * URL publique d'une clé.
 *
 * Avec `S3_PUBLIC_URL` (ex. `https://media.astraa.is-cool.dev`, un CDN Cloudflare
 * devant le bucket), les médias sont servis directement depuis le CDN : URL
 * absolue `https://media.astraa.is-cool.dev/<clé>`. Sans ce réglage (dev local,
 * CDN pas encore en place), on retombe sur le proxy de l'application
 * `/api/media/file/...` qui lit depuis S3 avec la clé d'application.
 *
 * URL absolue obligatoire dans les deux cas : themeConfigSchema valide les
 * URLs de médias avec .url(), qui rejette un chemin relatif.
 */
export function s3PublicUrl(key: string): string {
  const publicBase = (serverEnv().S3_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (publicBase) return `${publicBase}/${key}`;

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/media/file/${key}`;
}

export type PresignedUpload = {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
};

/**
 * URL présignée pour un PUT depuis la fonction Cloudflare du CDN médias.
 *
 * Seul `Content-Type` est signé (pas `Content-Length`) : la fonction reçoit
 * le fichier depuis le navigateur et le transfère en flux, sans connaître la
 * taille à l'avance — signer `content-length` ferait échouer la signature.
 * Le content-type étant dans la signature, le stockage rejette tout upload
 * qui ne correspond pas à ce qui a été validé.
 */
export async function createPresignedUpload(
  ownerId: string,
  type: MediaType,
  mimeType: string,
  sizeBytes: number
): Promise<PresignedUpload> {
  const key = buildMediaKey(ownerId, type, mimeType);
  const expiresInSeconds = 300;

  const command = new PutObjectCommand({
    Bucket: serverEnv().S3_BUCKET!,
    Key: key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
    CacheControl: "public, max-age=31536000, immutable",
  });

  const uploadUrl = await getSignedUrl(s3Client(), command, {
    expiresIn: expiresInSeconds,
    signableHeaders: new Set(["content-type"]),
  });

  return { uploadUrl, key, expiresInSeconds };
}

/** Envoie un buffer sur S3 (upload côté serveur). */
export async function s3PutObject(
  key: string,
  body: Buffer,
  mimeType: string
): Promise<void> {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: serverEnv().S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

/** Supprime un objet S3. Idempotent : S3 ne signale pas une clé absente. */
export async function s3DeleteObject(key: string): Promise<void> {
  await s3Client().send(
    new DeleteObjectCommand({ Bucket: serverEnv().S3_BUCKET!, Key: key })
  );
}

/**
 * Supprime plusieurs objets S3. Utilisé à la suppression d'un compte (RGPD) :
 * l'API S3 plafonne à 1000 clés par appel, on découpe en lots.
 */
export async function s3DeleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const bucket = serverEnv().S3_BUCKET!;

  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3Client().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
  }
}
