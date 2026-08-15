// ---------------------------------------------------------------------------
// Astra — proxy média avec cache (Cloudflare Pages Function)
//
// Route : media.astraa.is-cool.dev/*
//
// Rôle : servir les médias (avatars, bannières, vidéos, polices…) depuis le
// cache Cloudflare, en ne demandant l'ORIGINE qu'en cas de cache miss.
// L'origine est le proxy média de l'application (Vercel), qui lit le fichier
// depuis le bucket B2 privé avec la clé d'application. Aucune clé B2 ne vit
// ici : Cloudflare ne voit que l'URL publique de l'application.
//
// Flux :
//   Navigateur → media.astraa.is-cool.dev → (cache Cloudflare)
//                                    ↳ miss → Vercel /api/media/file/<clé> → B2
//
// Pourquoi une fonction : le bucket B2 reste privé (le rendre public exige
// une carte bancaire chez Backblaze), et Cloudflare ne peut pas lire un
// bucket privé sans authentification. La fonction fait ce travail, et le
// cache absorbe les vues répétées : chaque fichier n'est demandé à l'origine
// qu'environ une fois par mois (TTL edge), au lieu d'à chaque affichage —
// le quota quotidien de téléchargement B2 n'est donc plus consommé par les
// visiteurs.
//
// Déploiement : voir cloudflare/README.md (guide clic par clic).
// ---------------------------------------------------------------------------

// URL de l'application qui sert les médias (le proxy Next.js). À remplacer
// par ton domaine de production, ou à définir comme variable d'environnement
// MEDIA_ORIGIN dans le projet Pages (recommandé : pas de code à modifier).
const DEFAULT_ORIGIN = "https://astra-wheat-psi.vercel.app";



export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\/+/, "");

  // On ne sert que les clés de médias de l'app (u/{ownerId}/{type}/...).
  if (!key || !key.startsWith("u/") || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const origin = (env.MEDIA_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");
  const originUrl = `${origin}/api/media/file/${key}`;

  // 1. Cache hit ? La requête entière est servie depuis le cache Cloudflare,
  //    sans toucher ni Vercel ni B2. On refuse de servir une réponse 3xx
  //    depuis le cache : si une ancienne redirection (vers nous-mêmes, lors
  //    d'une précédente version) traînait dans le cache, on la jette et on
  //    re-demande l'origine — qui répondra correctement et écrasera le cache.
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached && cached.ok) return cached;

  // 2. Cache miss : on demande le fichier ENTIER à l'origine (sans Range),
  //    pour que le cache contienne l'objet complet. On n'utilise PAS
  //    `cf.cacheEverything` : il ferait mettre en cache par l'edge les
  //    réponses même non-2xx (ex. une ancienne 301), qui seraient ensuite
  //    servies sans jamais ré-exécuter cette fonction. Le cache est géré
  //    uniquement via `caches.default` ci-dessous (réponses 2xx seulement).
  //
  //    L'en-tête X-Astra-Proxy signale à l'application qu'on est le proxy
  //    CDN : elle sert alors le fichier depuis B2 SANS redirection (sinon
  //    elle nous renverrait vers nous-mêmes — boucle infinie). On interdit
  //    aussi de suivre les redirections, par sécurité.
  const originRequest = new Request(originUrl, {
    headers: request.headers,
  });
  originRequest.headers.set("x-astra-proxy", "1");
  originRequest.headers.delete("range");

  // Supprime toute réponse mise en cache pour l'URL d'origine (une ancienne
  // version de cette fonction utilisait `cf.cacheEverything`, qui a pu laisser
  // une 301 en cache edge servie sans jamais re-contacter l'application). Le
  // fetch interne doit TOUJOURS atteindre l'application ; seul le cache du
  // chemin public (clé = URL du visiteur) est utilisé, plus bas.
  await cache.delete(originRequest);

  const originResponse = await fetch(originRequest, {
    redirect: "manual",
  });

  if (!originResponse.ok) {
    return new Response(await originResponse.text(), {
      status: originResponse.status,
      headers: originResponse.headers,
    });
  }

  // 3. Réponse publique : cache navigateur long, CORS (polices @font-face et
  //    recadrage d'avatar en canvas), et annonce des Range (streaming vidéo).
  const headers = new Headers(originResponse.headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  headers.delete("Set-Cookie");

  const response = new Response(originResponse.body, {
    status: originResponse.status,
    headers,
  });

  // 4. Mise en cache en arrière-plan : le visiteur ne patiente pas sur
  //    l'écriture.
  const clone = response.clone();
  waitUntil(cache.put(request, clone));

  return response;
}
