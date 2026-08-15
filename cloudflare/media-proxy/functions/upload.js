// ---------------------------------------------------------------------------
// Astra — upload des gros médias (vidéos de fond) via le CDN
//
// Route : /upload?url=<URL S3 présignée Backblaze B2>
//
// Pourquoi cette fonction : le navigateur ne peut pas faire un PUT direct
// vers B2 (CORS du bucket) et la plateforme d'hébergement de l'app (Vercel)
// refuse les corps de requête au-delà de ~4,5 Mo. Cette fonction reçoit le
// fichier depuis le navigateur (limite Workers : 100 Mo) et le transfère vers
// l'URL présignée B2 en serveur-à-serveur :
//
//   Navigateur ──PUT──> astra-media.pages.dev/upload?url=<présigné B2>
//                                    │ (fetch serveur-à-serveur, aucun CORS)
//                                    └──> B2 (bucket privé, signature S3)
//
// Aucune clé B2 ne vit ici : l'URL présignée (5 min, une seule clé) est
// signée par l'application. La fonction ne sert pas de proxy ouvert : la
// cible doit être une URL présignée (paramètre X-Amz-Signature) vers un
// hôte de stockage autorisé.
//
// Déploiement : ce fichier va dans le dépôt GitHub du projet Pages
// (`functions/upload.js`), à côté de `functions/[[path]].js`.
// ---------------------------------------------------------------------------

// Hôte autorisé pour la cible (le endpoint S3 du bucket). Par défaut le
// domaine de Backblaze ; à surcharger via la variable d'environnement
// UPLOAD_TARGET_HOST du projet Pages si ton endpoint diffère.
const DEFAULT_ALLOWED_HOST = "backblazeb2.com";

// Limite du corps de requête Workers : 100 Mo.
const MAX_BODY_BYTES = 100 * 1024 * 1024;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

function hostAllowed(hostname, allowed) {
  return hostname === allowed || hostname.endsWith("." + allowed);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Préflight CORS du PUT navigateur → CDN.
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "PUT" && request.method !== "POST") {
    return json({ message: "Méthode non autorisée." }, 405);
  }

  const target = url.searchParams.get("url");
  if (!target) {
    return json({ message: "Paramètre `url` manquant." }, 400);
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return json({ message: "URL cible invalide." }, 400);
  }

  // Une URL présignée S3 porte X-Amz-Signature : on l'exige, et on vérifie
  // que la cible est sur un hôte de stockage autorisé. Sans ces deux
  // contrôles, la fonction serait un proxy ouvert.
  if (!parsed.searchParams.has("X-Amz-Signature")) {
    return json({ message: "Cible non présignée." }, 403);
  }

  const allowed = env.UPLOAD_TARGET_HOST || DEFAULT_ALLOWED_HOST;
  if (!hostAllowed(parsed.hostname, allowed)) {
    return json({ message: "Hôte cible non autorisé." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ message: "Fichier trop volumineux (100 Mo maximum via le CDN)." }, 413);
  }

  // Transfert vers B2 : même méthode PUT, même content-type (c'est lui qui
  // est signé dans l'URL présignée), corps en flux. On ne force pas le
  // content-length : la signature ne l'inclut pas, et le fetch Workers
  // transfère le flux tel quel.
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let upstream;
  try {
    upstream = await fetch(parsed, {
      method: "PUT",
      headers,
      body: request.body,
    });
  } catch {
    return json({ message: "Échec du transfert vers le stockage." }, 502);
  }

  const responseHeaders = corsHeaders();
  const location = upstream.headers.get("location");
  if (location) responseHeaders["Location"] = location;

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
