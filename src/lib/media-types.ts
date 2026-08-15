/**
 * Inférence du type MIME à partir de l'extension du nom de fichier.
 *
 * Certains navigateurs (et certains formats rares comme `.mpa`) renvoient un
 * `File.type` vide ou inattendu. La liste blanche de `validateUpload` exige un
 * type réel : on déduit le MIME du nom pour que ces fichiers restent
 * acceptés. Aucune dépendance serveur : utilisable côté client et côté
 * serveur.
 */

const EXTENSION_MIME: Record<string, string> = {
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  cur: "image/x-icon",
  // Audio
  mp3: "audio/mpeg",
  mpa: "audio/mpeg",
  mp2: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  weba: "audio/webm",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  // Vidéo
  mp4: "video/mp4",
  webm: "video/webm",
  // Polices
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

/** Type MIME déduit de l'extension du nom, ou `undefined` si inconnue. */
export function inferMimeFromName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext];
}
