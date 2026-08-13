import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { isS3Storage } from "@/lib/env";
import { localFilePath } from "@/lib/storage";

/**
 * GET /api/media/file/[...path]
 *
 * Sert un fichier du stockage local, avec support des requêtes Range HTTP.
 *
 * Le support des Range est indispensable pour la vidéo : sans lui, le
 * navigateur télécharge le fichier ENTIER avant de commencer à lire — une
 * vidéo de fond de plusieurs dizaines de mégaoctets (a fortiori en 4K) mettrait
 * des secondes à démarrer. Avec les Range, le lecteur récupère le premier
 * segment et lance la lecture pendant que le reste se télécharge en continu.
 *
 * N'existe que pour le mode local ; en S3, les URL pointent sur le bucket/CDN,
 * qui gère les Range nativement.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  if (isS3Storage()) {
    return new Response("Not found", { status: 404 });
  }

  const { path } = await context.params;
  const key = path.join("/");

  let filePath: string;
  try {
    filePath = localFilePath(key);
  } catch {
    return new Response("Invalid path", { status: 400 });
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (!fileStat.isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const size = fileStat.size;
  const contentType = mimeFromExtension(key);

  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    // Annonce au navigateur qu'il peut demander des segments. C'est ce qui
    // débloque le streaming vidéo et le déplacement dans la timeline.
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  const range = request.headers.get("range");

  // --- Requête partielle : le lecteur demande un segment -------------------
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());

    if (match) {
      let start = match[1] ? Number.parseInt(match[1], 10) : 0;
      let end = match[2] ? Number.parseInt(match[2], 10) : size - 1;

      // Borne les valeurs : un client peut demander n'importe quoi.
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= size) end = size - 1;

      // Plage incohérente : 416 avec la taille réelle, comme l'exige la RFC.
      if (start > end || start >= size) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new Response(webStream, {
        status: 206, // Partial Content
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(chunkSize),
        },
      });
    }
  }

  // --- Fichier entier ------------------------------------------------------
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  weba: "audio/webm",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

function mimeFromExtension(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
