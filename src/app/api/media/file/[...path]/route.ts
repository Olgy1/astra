import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { isS3Storage, serverEnv } from "@/lib/env";
import { s3Client } from "@/lib/s3";
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
 * En mode local, lit le fichier sur disque. En mode S3 avec `S3_PUBLIC_URL`
 * (CDN Cloudflare devant le bucket), redirige en 301 vers le domaine public :
 * les anciennes URLs déjà stockées continuent de marcher sans lire B2. En
 * mode S3 sans CDN, sert le proxy média : le bucket peut être privé (B2
 * gratuit n'autorise pas les buckets publics), l'application lit l'objet avec
 * sa clé et renvoie le flux — les requêtes Range sont transmises à S3, qui
 * les gère nativement (indispensable pour le streaming vidéo).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params;
  const key = path.join("/");

  if (!key || key.includes("..") || key.startsWith("/")) {
    return new Response("Invalid path", { status: 400 });
  }

  if (isS3Storage()) {
    // Requête du proxy CDN (fonction Cloudflare Pages) : on sert depuis B2
    // directement, sans redirection — sinon la fonction se retrouverait en
    // boucle (elle appelle cette route, qui la redirigerait vers elle-même).
    const fromProxy = request.headers.get("x-astra-proxy") === "1";
    if (!fromProxy) {
      // CDN en place : redirection vers le domaine public. Servie par Vercel
      // sans toucher B2 — c'est le cache CDN qui renverra le fichier.
      const publicBase = (serverEnv().S3_PUBLIC_URL ?? "").replace(/\/+$/, "");
      if (publicBase) return Response.redirect(`${publicBase}/${key}`, 301);
    }

    return serveFromS3(key, request.headers.get("range"));
  }

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
    // Les médias sont publics et peuvent être affichés depuis n'importe
    // quelle origine (futur domaine astraa.is-cool.dev, polices chargées en CORS...).
    "Access-Control-Allow-Origin": "*",
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

/** Sert un objet S3 (bucket privé) avec support des requêtes Range. */
async function serveFromS3(
  key: string,
  range: string | null
): Promise<Response> {
  const command = new GetObjectCommand({
    Bucket: serverEnv().S3_BUCKET!,
    Key: key,
    ...(range ? { Range: range } : {}),
  });

  let result;
  try {
    result = await s3Client().send(command);
  } catch (error) {
    console.error("[media] erreur S3 :", error);
    // On distingue le 403 (clé invalide, ou quota de téléchargement B2 du
    // jour dépassé — le plan gratuit) du 404 (objet absent). Avant, tout
    // tombait dans le même « Not found », et un quota B2 atteint se voyait
    // comme une image cassée sans explication.
    const status =
      (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata
        ?.httpStatusCode ?? 0;
    if (status === 403) {
      return new Response(
        "Stockage inaccessible (HTTP 403) : quota de téléchargement du jour atteint ou clé invalide.",
        {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        }
      );
    }
    return new Response("Not found", { status: 404 });
  }

  if (!result.Body) {
    return new Response("Not found", { status: 404 });
  }

  // En runtime Node, Body est un flux Readable (le type SDK est une union).
  const body = result.Body as Readable;

  const headers: Record<string, string> = {
    "Content-Type": result.ContentType ?? mimeFromExtension(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
  };

  if (result.ContentLength !== undefined) {
    headers["Content-Length"] = String(result.ContentLength);
  }
  if (result.ContentRange) {
    headers["Content-Range"] = result.ContentRange;
  }

  return new Response(Readable.toWeb(body) as ReadableStream, {
    status: result.$metadata.httpStatusCode,
    headers,
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
