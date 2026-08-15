"use client";

import type { MediaType } from "@prisma/client";

/**
 * Upload de médias côté client.
 *
 * Le fichier transite par le serveur Next.js (`/api/media/upload`), qui le
 * valide (type MIME, taille) et l'écrit sur le stockage configuré — local en
 * développement, S3/Backblaze en production. Ce flux fonctionne sans rien
 * configurer sur le bucket : le navigateur ne parle qu'à l'API du site,
 * jamais directement au stockage.
 *
 * Un ancien flux « upload direct » (URL présignée, PUT navigateur → S3) a été
 * retiré : il exigeait une règle CORS sur le bucket B2, et son échec bloquait
 * tous les uploads. Le flux serveur est le chemin unique, comme avant.
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

/** Upload d'un média, quel que soit le mode de stockage du serveur. */
export async function uploadFile(params: UploadFileParams): Promise<UploadResult> {
  return uploadThroughServer(params);
}
