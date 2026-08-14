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
 * Stockage des médias.
 *
 * Les uploads passent par une URL présignée : le fichier va du navigateur
 * directement à S3, sans transiter par le serveur Next.js. Ça évite de faire
 * remonter un background vidéo de 30 Mo à travers une route handler, et de
 * heurter la limite de taille de body des plateformes serverless.
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
    mimeTypes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"],
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
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
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
 * Avec `S3_PUBLIC_URL` (ex. `https://media.astra.is-a.dev`, un CDN Cloudflare
 * devant le bucket), les médias sont servis directement depuis le CDN : URL
 * absolue `https://media.astra.is-a.dev/<clé>`. Sans ce réglage (dev local,
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
  publicUrl: string;
  expiresInSeconds: number;
};

/**
 * URL présignée pour un PUT direct depuis le navigateur.
 *
 * `ContentType` et `ContentLength` sont inclus dans la signature : S3 rejette
 * la requête si le client envoie autre chose que ce qu'il a déclaré. Sans ça,
 * un client pourrait annoncer une image de 2 Mo et téléverser un exécutable
 * de 2 Go.
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
    signableHeaders: new Set(["content-type", "content-length"]),
  });

  return { uploadUrl, key, publicUrl: s3PublicUrl(key), expiresInSeconds };
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
