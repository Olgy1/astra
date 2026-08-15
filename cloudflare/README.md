# CDN médias — media.astraa.is-cool.dev (Cloudflare Pages, sans carte bancaire)

Objectif : servir les médias (avatars, bannières, vidéos, polices…) depuis le
cache Cloudflare pour ne plus consommer le quota quotidien de téléchargement
Backblaze B2. Le bucket reste **privé** — aucune carte bancaire requise.

```
Navigateur → media.astraa.is-cool.dev
                ↓
    Cloudflare Pages (fonction cache-proxy, TON compte, gratuit)
                ↓ (cache miss seulement, ~1×/mois/fichier)
    Vercel /api/media/file/<clé>   (proxy existant : auth B2 + Range + CORS)
                ↓
    B2 (bucket privé, clé App)
```

La fonction est dans `cloudflare/media-proxy/functions/[[path]].js`.

---

## A. Créer le mini-dépôt GitHub (2 min)

1. Va sur **github.com** → bouton **+** (en haut à droite) → **New repository**.
2. Nom : `astra-media`. Laisse « Public » ou passe en « Private » (peu importe).
   **Ne coche pas** « Add a README ». → **Create repository**.
3. Sur la page du repo, clique **Add file** → **Create new file**.
4. Dans « Name your file… », tape exactement : `functions/[[path]].js`
   (les crochets font partie du nom).
5. Colle le contenu de `cloudflare/media-proxy/functions/[[path]].js` (ouvre-le
   dans ce projet et copie tout).
6. **Commit changes** (le message n'a pas d'importance).
7. Recommence **Add file** → **Create new file** avec le nom `public/.gitkeep`
   (fichier vide), puis **Commit changes**.

## B. Créer le projet Cloudflare Pages (5 min)

1. Va sur **dash.cloudflare.com** → **Sign up** (gratuit, **aucune carte**).
   Si tu as déjà un compte Cloudflare, connecte-toi.
2. Dans le menu de gauche : **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
3. Autorise GitHub si demandé, puis choisis le dépôt **`astra-media`**.
4. **Framework preset** : `None`.
5. **Build command** : laisse **vide** — ⚠️ ne mets PAS `npx wrangler deploy` :
   c'est la commande du mode Workers, qui échoue sur un projet Pages
   (`Could not detect a directory containing static files`).
6. **Build output directory** : tape `public`.
7. Clique **Save and Deploy**. Attends la fin du déploiement (1-2 min).

> ⚠️ **Piège fréquent** : dans le nouveau tableau de bord, « Create » propose
> Workers ET Pages. Il faut bien créer un projet **Pages** (onglet Pages →
> Connect to Git). Un projet Workers connecté à Git lance `npx wrangler
> deploy` et échoue sur ce dépôt (dossier `functions/` = mode Pages).
> Si c'est arrivé : supprimer le projet (Settings → Danger zone → Delete) et
> recréer en Pages. Le dépôt contient `public/index.html` (placeholder) pour
> que le dossier statique soit toujours détecté.
8. Note le domaine par défaut affiché (ex. `astra-media.pages.dev`) : il te
   faudra pour le fichier DNS de l'étape D. Vérifie qu'il répond :
   `https://astra-media.pages.dev/` → page vide sans erreur.

## C. Attacher media.astraa.is-cool.dev au projet Pages (5 min)

Le domaine appartient au projet is-a.dev (qui est sur la liste des suffixes
publics), donc on ne peut pas l'ajouter depuis le tableau de bord Pages : il
faut passer par l'API, exactement comme le guide officiel is-a.dev le décrit :
**https://docs.is-a.dev/guides/cloudflare-pages/** (section « Adding the domain
to Cloudflare Pages »).

1. Récupère ton **Account ID** Cloudflare : dashboard → en bas à gauche de la
   page d'accueil.
2. Utilise **l'outil GUI** mis à disposition par is-a.dev (lien dans le guide
   ci-dessus) pour attacher `media.astraa.is-cool.dev` à ton projet Pages.
   - Alternative (cURL) : la commande du guide avec ton `account_id`, ton nom
     de projet et le hostname `media.astraa.is-cool.dev`.
3. L'attache peut être faite **avant** le merge du PR (étape D) : le
   certificat SSL sera émis automatiquement quand le DNS pointera.

## D. Déclarer le sous-domaine chez is-a.dev (PR GitHub)

1. Va sur **github.com/is-a-dev/register** → **Fork** (si ce n'est pas déjà
   fait, comme pour ta première PR).
2. Dans ton fork, ouvre le dossier **`domains/`** → **Add file** →
   **Create new file**.
3. Nom du fichier : **`media.astra.json`** (les points créent le sous-domaine
   imbriqué `media.astraa.is-cool.dev`).
4. Contenu (remplace `astra-media.pages.dev` par **ton** domaine Pages de
   l'étape B) :
   ```json
   {
     "owner": {
       "username": "olgy1",
       "email": "gls.kyle@icloud.com"
     },
     "records": {
       "CNAME": "astra-media.pages.dev"
     }
   }
   ```
5. **Commit changes** sur ton fork, puis **Contribute** → **Open pull request**
   vers le dépôt is-a.dev/register, avec le même template de cases à cocher
   que la première fois.
6. Attends le merge (cela peut prendre quelques jours).

## E. Tester (avant de basculer l'app)

Une fois le PR mergé + DNS propagé (quelques heures) + certificat émis :

1. Récupère une clé média existante : ouvre ta base et prends une URL, ou
   affiche une page publiée et copie l'URL d'une image/vidéo (elle contient
   `u/{ownerId}/{type}/{uuid}.ext`).
2. Teste dans le navigateur :
   `https://media.astraa.is-cool.dev/u/{ownerId}/{type}/{uuid}.ext` → la
   ressource s'affiche.
3. Vérifie le cache (2e chargement, en-têtes de la requête dans les DevTools) :
   `cf-cache-status: HIT`.
4. Vérifie le streaming vidéo (Range) :
   ```bash
   curl -sI -H "Range: bytes=0-1023" "https://media.astraa.is-cool.dev/<clé-vidéo>"
   ```
   → doit répondre **206 Partial Content**.

## F. Basculer l'application (dernière étape, ~2 min)

⚠️ **Ne fais cette étape qu'après avoir validé l'étape E** : tant que le CDN
n'est pas en ligne, les médias seraient introuvables.

1. Va sur **vercel.com** → ton projet **astra** → **Settings** →
   **Environment Variables**.
2. Ajoute : clé `S3_PUBLIC_URL`, valeur `https://media.astraa.is-cool.dev`
   (environnements **Production** et **Preview**).
3. **Save** puis redéploie (Deployments → derniers → **Redeploy**).
4. Vérifie : upload d'une image dans l'éditeur → l'URL renvoyée commence par
   `https://media.astraa.is-cool.dev/...` et la page l'affiche. Upload d'une vidéo
   de fond → lecture OK. Les anciennes URLs (`/api/media/file/...`) continuent
   de marcher (redirection 301 vers le CDN, sans toucher B2).

## G. Upload des gros fichiers (vidéos de fond) — fonction `upload`

L'application upload les petits fichiers par le serveur (Vercel limite le
corps des requêtes à ~4,5 Mo). Les **vidéos de fond** dépassent cette limite :
le navigateur les envoie à cette fonction, qui les transfère vers B2 en
serveur-à-serveur (URL présignée signée par l'application, expirant en 5 min).
Aucune clé B2 dans Cloudflare, aucun CORS de bucket à configurer.

1. Dans ton dépôt GitHub **astra-media**, ajoute le fichier
   `functions/upload.js` (contenu : `cloudflare/media-proxy/functions/upload.js`
   de ce projet) — à côté de `functions/[[path]].js`. GitHub web :
   **Add file → Create new file → colle → Commit**. Le projet Pages
   redéploie automatiquement (~1-2 min).
2. *(Optionnel)* si ton endpoint B2 n'est pas sur `backblazeb2.com`, ajoute la
   variable d'environnement `UPLOAD_TARGET_HOST` dans le projet Pages
   (Settings → Environment variables) avec le hostname de ton endpoint S3.
3. Rien d'autre à configurer : l'application envoie déjà les gros fichiers à
   `https://<CDN>/upload?url=<présigné>` (voir `S3_PUBLIC_URL`).

Test rapide : upload d'une vidéo de fond dans l'éditeur → elle se téléverse
via le CDN et s'affiche. La fonction plafonne à **100 Mo** (limite Workers) ;
au-delà, l'application refuse avec un message clair avant l'upload.

## Rappel quota B2

- **Servi par le cache Cloudflare** : tout ce qui est déjà chargé une fois
  (1 mois de TTL edge + 1 an de cache navigateur).
- **Demandé à B2** : uniquement le premier chargement de chaque fichier
  (ou après expiration du cache) — c'est le transfert B2 → Cloudflare, gratuit
  et illimité (Bandwidth Alliance).
- **Aucune carte** : bucket privé conservé, Cloudflare plan gratuit.
