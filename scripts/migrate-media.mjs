// ---------------------------------------------------------------------------
// Migration des médias locaux (.uploads/) vers un bucket S3 (Backblaze B2).
//
// Les fichiers locaux sont déjà rangés sous `u/{ownerId}/{type}/{uuid}.ext`,
// exactement la structure des clés S3 utilisées par l'app. Ce script remonte
// chaque fichier tel quel dans le bucket, avec la même clé : aucune
// modification des URLs n'est nécessaire du côté des fichiers eux-mêmes.
//
// Usage :
//   1. Renseigner les variables S3_* dans .env (voir .env.example)
//   2. node --env-file=.env scripts/migrate-media.mjs
//
// Les URLs stockées en base (media_assets.url, theme_config, blocks.config,
// og_image_url) pointent encore vers /api/media/file/... — il faut ensuite
// appliquer la requête SQL donnée dans le guide de migration pour les faire
// pointer vers S3_PUBLIC_HOST.
// ---------------------------------------------------------------------------

import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".cur": "image/x-icon",
  ".ico": "image/x-icon",
};

function env(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Variable ${name} manquante dans .env`);
    process.exit(1);
  }
  return value;
}

async function listFiles(dir) {
  const out = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

async function main() {
  const storageDir = process.env.LOCAL_STORAGE_DIR || ".uploads";
  const files = await listFiles(storageDir);

  // Ignorer .DS_Store et autres fichiers non-médias à la racine
  const mediaFiles = files.filter((f) => {
    const rel = relative(storageDir, f);
    return rel.startsWith("u/") && !rel.includes(".DS_Store");
  });

  if (mediaFiles.length === 0) {
    console.log("Aucun fichier média à migrer dans", storageDir);
    return;
  }

  const client = new S3Client({
    region: env("S3_REGION"),
    endpoint: env("S3_ENDPOINT"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: env("S3_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
    },
  });

  const bucket = env("S3_BUCKET");
  console.log(`📦 ${mediaFiles.length} fichier(s) → s3://${bucket}/`);
  console.log("");

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of mediaFiles) {
    const key = relative(storageDir, file).split("/").join("/"); // "u/ownerId/type/uuid.ext"
    const mime = MIME_BY_EXT[extname(file).toLowerCase()] ?? "application/octet-stream";
    const size = (await stat(file)).size;

    try {
      const body = await readFile(file);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: mime,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      console.log(`  ✓ ${key} (${(size / 1024 / 1024).toFixed(1)} Mo, ${mime})`);
      uploaded++;
    } catch (error) {
      console.error(`  ✗ ${key} :`, error.message);
      failed++;
    }
  }

  console.log("");
  console.log(`✅ Terminé : ${uploaded} uploadé(s), ${skipped} ignoré(s), ${failed} échec(s).`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
