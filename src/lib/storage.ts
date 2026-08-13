import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { MediaType } from "@prisma/client";
import { isS3Storage, assertStorageConfigured, serverEnv } from "@/lib/env";
import {
  buildMediaKey,
  s3PublicUrl,
  s3PutObject,
  s3DeleteObject,
  s3DeleteObjects,
} from "@/lib/s3";

/**
 * Stockage des médias : abstraction locale / S3.
 *
 * Même philosophie que l'email : le site tourne sans infra externe. En
 * l'absence de S3 (STORAGE_DRIVER=local, le défaut), les fichiers sont écrits
 * sur le disque du serveur et servis par une route handler. Basculer en
 * production se fait en posant STORAGE_DRIVER=s3 et les variables S3 —
 * aucun code applicatif ne change, seul ce module connaît la différence.
 *
 * L'upload local passe par le serveur (le fichier transite dans la requête),
 * là où S3 propose l'upload direct présigné. Pour du dev et une petite
 * instance, faire transiter un avatar par le serveur est sans conséquence ;
 * pour de la vidéo de fond à l'échelle, on passe sur S3.
 */

function localDir(): string {
  return join(process.cwd(), serverEnv().LOCAL_STORAGE_DIR);
}

export type StoredFile = {
  key: string;
  url: string;
  sizeBytes: number;
};

/**
 * Enregistre un fichier et renvoie sa clé et son URL publique.
 *
 * La clé est construite côté serveur (`u/{ownerId}/...`) : elle n'est jamais
 * fournie par le client, ce qui garantit qu'un upload ne peut pas écraser le
 * fichier d'un autre compte.
 */
export async function storeFile(
  ownerId: string,
  type: MediaType,
  body: Buffer,
  mimeType: string
): Promise<StoredFile> {
  const key = buildMediaKey(ownerId, type, mimeType);

  if (isS3Storage()) {
    assertStorageConfigured();
    await s3PutObject(key, body, mimeType);
    return { key, url: s3PublicUrl(key), sizeBytes: body.length };
  }

  // Mode local. Le chemin est dérivé de la clé, elle-même construite par le
  // serveur : pas de composant fourni par l'utilisateur, donc pas de
  // traversée de répertoire possible. On vérifie quand même que le chemin
  // résolu reste sous le dossier de stockage, par principe de défense.
  const base = localDir();
  const target = join(base, key);

  if (!target.startsWith(base + "/")) {
    throw new Error("Chemin de stockage invalide.");
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);

  return { key, url: publicUrl(key), sizeBytes: body.length };
}

/** URL publique d'une clé, selon le mode de stockage. */
export function publicUrl(key: string): string {
  if (isS3Storage()) return s3PublicUrl(key);
  // Servie par la route handler qui lit le fichier local. URL ABSOLUE et non
  // relative : `themeConfigSchema` valide les URL de médias avec `.url()`,
  // qui rejette un chemin relatif. Une URL relative ferait échouer la
  // validation du thème et le renvoyait au défaut — fond vide.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/media/file/${key}`;
}

/** Supprime un objet. Idempotent. */
export async function deleteStoredObject(key: string): Promise<void> {
  if (isS3Storage()) {
    await s3DeleteObject(key);
    return;
  }

  try {
    await unlink(join(localDir(), key));
  } catch (error) {
    // Fichier déjà absent : pas une erreur, le résultat voulu est atteint.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Supprime plusieurs objets. Utilisé à la suppression d'un compte (RGPD). */
export async function deleteStoredObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  if (isS3Storage()) {
    await s3DeleteObjects(keys);
    return;
  }

  await Promise.all(keys.map((key) => deleteStoredObject(key)));
}

/** Chemin absolu d'un fichier local, pour la route handler qui le sert. */
export function localFilePath(key: string): string {
  const base = localDir();
  const target = join(base, key);
  if (!target.startsWith(base + "/")) {
    throw new Error("Chemin invalide.");
  }
  return target;
}
