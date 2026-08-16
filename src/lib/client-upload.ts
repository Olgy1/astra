"use client";

import type { MediaType } from "@prisma/client";
import { inferMimeFromName, MEDIA_MAX_BYTES } from "@/lib/media-types";

/**
 * Upload de médias côté client.
 *
 * Deux chemins, choisis selon la taille du fichier — quel que soit le type
 * de média (avatar, bannière, fond, curseur, police, audio) :
 *  - **petit fichier** (≤ 4,5 Mo) : multipart via `/api/media/upload`. Le
 *    serveur valide, écrit sur le stockage (local ou S3) et enregistre en
 *    base. Simple : un seul aller-retour.
 *  - **gros fichier** (> 4,5 Mo — la limite de body de Vercel) : via le CDN
 *    Cloudflare. Le serveur signe une URL d'upload B2 (`/api/media/presign`),
 *    le navigateur envoie le fichier à la fonction Cloudflare Pages du CDN
 *    médias (`/upload`), qui le transfère vers B2 en serveur-à-serveur —
 *    aucun CORS de bucket à configurer, aucune clé B2 dans le navigateur.
 *    Une confirmation (`/api/media/confirm`) enregistre ensuite l'asset en
 *    base. Le flux CDN n'est borné que par le plafond de la fonction (95 Mo),
 *    pas par la limite par type du serveur.
 *
 * Dans les deux cas le navigateur ne parle qu'à l'API du site ou au CDN,
 * jamais directement au bucket.
 */

export type UploadedAsset = { id: string; type: MediaType; url: string; key: string };

export type UploadFileParams = {
  file: File;
  type: MediaType;
  biolinkId: string;
  onProgress?: (percent: number) => void;
};

export type UploadResult = { ok: true; asset: UploadedAsset } | { ok: false; message: string };

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error?: { message?: string } };

/** Limite de body des plateformes serverless (Vercel) : au-delà, le flux CDN. */
const SERVER_UPLOAD_LIMIT = 4.5 * 1024 * 1024;

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Upload multipart via le serveur (stockage local ou S3, sans CORS à configurer). */
async function uploadThroughServer({ file, type, biolinkId, onProgress }: UploadFileParams): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  form.append("biolinkId", biolinkId);

  // XMLHttpRequest et non fetch : lui seul expose la progression d'upload,
  // ce qui compte pour une vidéo de fond de plusieurs mégaoctets.
  const body = await new Promise<{ status: number; result: ApiResponse<{ asset: UploadedAsset }> | null }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => resolve({ status: xhr.status, result: parseJson(xhr.responseText) });
    xhr.onerror = () => resolve({ status: 0, result: null });
    xhr.send(form);
  });

  if (body.status === 0) {
    return { ok: false, message: "Échec de l'upload (réseau). Réessayez." };
  }

  if (body.status === 413) {
    return {
      ok: false,
      message: "Fichier trop volumineux pour le serveur (limite de la plateforme d'hébergement).",
    };
  }

  if (body.status < 200 || body.status >= 300) {
    return { ok: false, message: `L'upload a échoué (HTTP ${body.status}).` };
  }

  if (!body.result) return { ok: false, message: "Réponse d'upload invalide." };
  if (!body.result.ok) return { ok: false, message: body.result.error?.message ?? "Échec de l'upload." };
  if (!body.result.data?.asset) return { ok: false, message: "Réponse d'upload invalide." };
  return { ok: true, asset: body.result.data.asset };
}

/** Upload des gros fichiers via le CDN Cloudflare (PUT → fonction, puis confirmation). */
async function uploadThroughCdn({
  file,
  type,
  biolinkId,
  mimeType,
  onProgress,
}: UploadFileParams & { mimeType: string }): Promise<UploadResult> {
  // 1. Le serveur valide type/taille, signe une URL d'upload B2 et renvoie
  //    l'URL de la fonction CDN qui la transférera.
  let presign: ApiResponse<{
    presigned?: boolean;
    uploadUrl?: string;
    key?: string;
    requiredHeaders?: Record<string, string>;
  }> | null = null;
  try {
    const response = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        mimeType,
        sizeBytes: file.size,
        biolinkId,
      }),
    });
    presign = parseJson(await response.text());
  } catch {
    presign = null;
  }

  if (!presign?.ok) {
    return { ok: false, message: presign?.error?.message ?? "Impossible de préparer l'upload." };
  }

  // Stockage local : pas de CDN, on passe par le serveur.
  if (presign.data.presigned === false) {
    return uploadThroughServer({ file, type, biolinkId, onProgress });
  }

  const { uploadUrl, key, requiredHeaders } = presign.data;
  if (!uploadUrl || !key) {
    return { ok: false, message: "Réponse de préparation d'upload invalide." };
  }

  // 2. PUT du fichier vers la fonction CDN (`/upload?url=<url présignée B2>`),
  //    qui le transfère vers le stockage en serveur-à-serveur. L'en-tête
  //    Content-Type est signé dans l'URL : il faut l'envoyer tel quel, sinon
  //    le stockage refuse. XHR expose la progression.
  const put = await new Promise<{ status: number; message?: string }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);

    if (requiredHeaders) {
      for (const [name, value] of Object.entries(requiredHeaders)) {
        xhr.setRequestHeader(name, value);
      }
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status });
      } else {
        resolve({
          status: xhr.status,
          message: parseJson<{ message?: string }>(xhr.responseText)?.message,
        });
      }
    };

    xhr.onerror = () => resolve({ status: 0 });
    xhr.send(file);
  });

  if (put.status === 0) {
    return {
      ok: false,
      message: "L'upload via le CDN a échoué (réseau). Réessayez.",
    };
  }

  if (put.status >= 300) {
    return {
      ok: false,
      message: put.message ?? `Le CDN a refusé le fichier (HTTP ${put.status}).`,
    };
  }

  // 3. Confirmation : le serveur interroge l'objet (HeadObject) pour vérifier
  //    qu'il existe vraiment, puis enregistre l'asset en base (et purge
  //    l'ancien média du même type).
  let confirm: ApiResponse<{ asset: UploadedAsset }> | null = null;
  try {
    const response = await fetch("/api/media/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, type, mimeType, biolinkId }),
    });
    confirm = parseJson(await response.text());
  } catch {
    confirm = null;
  }

  if (!confirm) {
    return { ok: false, message: "Le fichier est uploadé mais son enregistrement a échoué." };
  }
  if (!confirm.ok) {
    return { ok: false, message: confirm.error?.message ?? "Le fichier est uploadé mais son enregistrement a échoué." };
  }
  if (!confirm.data?.asset) return { ok: false, message: "Réponse de confirmation invalide." };

  return { ok: true, asset: confirm.data.asset };
}

/** Upload d'un média, quel que soit le mode de stockage du serveur. */
export async function uploadFile(params: UploadFileParams): Promise<UploadResult> {
  // Type MIME réel du fichier. Quand le navigateur n'en fournit pas ou
  // renvoie un type générique (certains formats rares comme .mpa, ou les
  // fichiers .cur/.ico sur certains navigateurs → application/octet-stream),
  // on le déduit de l'extension du nom — sinon la liste blanche rejetterait
  // le fichier (HTTP 422).
  const browserType = params.file.type;
  const mimeType =
    browserType && browserType !== "application/octet-stream"
      ? browserType
      : inferMimeFromName(params.file.name) || browserType || "application/octet-stream";

  // Les petits fichiers passent par le serveur (un seul aller-retour). Les
  // autres passent par le CDN Cloudflare : au-delà de la limite de body de
  // Vercel (~4,5 Mo), OU au-delà de la limite propre au type (le serveur
  // refuse un curseur PNG > 512 Ko même s'il tient dans 4,5 Mo — le CDN,
  // lui, accepte jusqu'à 95 Mo, pour n'importe quel type).
  const typeLimit = MEDIA_MAX_BYTES[params.type] ?? Number.POSITIVE_INFINITY;
  if (params.file.size <= SERVER_UPLOAD_LIMIT && params.file.size <= typeLimit) {
    return uploadThroughServer(params);
  }
  return uploadThroughCdn({ ...params, mimeType });
}
