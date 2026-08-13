"use client";

import type { MediaType } from "@prisma/client";

/**
 * Upload de médias côté client.
 *
 * Deux flux possibles, choisis par le serveur :
 *   - **présigné** (stockage S3/Backblaze, la production) : le serveur valide
 *     le type et la taille, puis renvoie une URL présignée. Le navigateur fait
 *     un PUT direct vers le stockage — le fichier (une vidéo de fond fait des
 *     dizaines de Mo) ne transite jamais par le serveur Next.js. C'est le seul
 *     moyen de contourner la limite de body des plateformes serverless
 *     (4,5 Mo chez Vercel). Une confirmation (`/api/media/confirm`) enregistre
 *     ensuite l'asset en base, après vérification réelle de l'objet.
 *   - **via serveur** (`/api/media/upload`, stockage local) : le fichier
 *     transite par Next.js, comme avant. Ce flux sert au développement local.
 *
 * Les deux renvoient le même résultat : l'asset enregistré.
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

/** Flux multipart via le serveur (stockage local). */
async function uploadThroughServer({ file, type, biolinkId, onProgress }: UploadFileParams): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  form.append("biolinkId", biolinkId);

  // XMLHttpRequest et non fetch : lui seul expose la progression d'upload,
  // ce qui compte pour une vidéo de fond de plusieurs mégaoctets.
  const body = await new Promise<ApiResponse<{ asset: UploadedAsset }> | null>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => resolve(parseJson(xhr.responseText));
    xhr.onerror = () => resolve(null);
    xhr.send(form);
  });

  if (!body) return { ok: false, message: "Échec de l'upload." };
  if (!body.ok) return { ok: false, message: body.error?.message ?? "Échec de l'upload." };
  if (!body.data?.asset) return { ok: false, message: "Réponse d'upload invalide." };
  return { ok: true, asset: body.data.asset };
}

/** Flux présigné : PUT direct navigateur → stockage, puis confirmation. */
async function uploadThroughStorage({ file, type, biolinkId, onProgress }: UploadFileParams): Promise<UploadResult> {
  // 1. Le serveur valide type/taille et signe une URL d'upload.
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
        mimeType: file.type || "application/octet-stream",
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

  // Stockage local : pas d'URL présignée possible, on passe par le serveur.
  if (presign.data.presigned === false) {
    return uploadThroughServer({ file, type, biolinkId, onProgress });
  }

  const { uploadUrl, key, requiredHeaders } = presign.data;
  if (!uploadUrl || !key) {
    return { ok: false, message: "Réponse de préparation d'upload invalide." };
  }

  // 2. PUT direct du fichier vers le stockage. Les en-têtes requis font
  //    partie de la signature : il faut les envoyer tels quels, sinon le
  //    stockage refuse. XHR est seul à exposer la progression.
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

    // status 0 : échec réseau ou blocage CORS du bucket — on ne peut pas
    // distinguer les deux depuis le navigateur.
    xhr.onerror = () => resolve({ status: 0 });
    xhr.send(file);
  });

  if (put.status === 0) {
    return {
      ok: false,
      message:
        "L'upload direct a échoué (réseau ou CORS du bucket non configuré). Vérifiez la règle CORS du bucket sur Backblaze.",
    };
  }

  if (put.status >= 300) {
    return {
      ok: false,
      message: put.message ?? `Le stockage a refusé le fichier (HTTP ${put.status}).`,
    };
  }

  // 3. Confirmation : le serveur interroge l'objet (HeadObject) pour vérifier
  //    qu'il existe vraiment, puis enregistre l'asset en base.
  let confirm: ApiResponse<{ asset: UploadedAsset }> | null = null;
  try {
    const response = await fetch("/api/media/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, type, biolinkId }),
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
  return uploadThroughStorage(params);
}
