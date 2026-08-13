# Astra — plateforme de biolink

Chaque utilisateur inscrit dispose d'une page publique personnalisable
(`astra.is-a.dev/pseudo`) regroupant ses liens, réseaux, médias et widgets. Un
membre a droit à un biolink, un administrateur à autant qu'il veut, plus un
panel de gestion de la plateforme.

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend & API | Next.js 15 (App Router, route handlers) | Le rendu serveur des pages `/[slug]` est natif, et un seul déploiement au lieu de deux. |
| Base de données | PostgreSQL 15+ via Prisma | JSONB indexable : la personnalisation évolue sans migration. |
| Cache & sessions | Redis 7 | Cache des pages publiques, rate limiting, révocation de sessions. |
| Médias | S3 — Backblaze B2 en production | Upload direct navigateur → S3 par URL présignée (B2 est compatible API S3). |
| Emails | Nodemailer + SMTP | Service centralisé, chaque envoi tracé dans `email_logs` (panel admin → Emails). |
| Auth | Argon2id + JWT/refresh tokens | Voir [Sécurité](#sécurité). |
| Style | TailwindCSS 4 | — |

## Installation

### Prérequis

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Un bucket S3 (ou MinIO en local)

### 1. Dépendances

```bash
npm install
```

### 2. Services locaux

Le plus rapide, avec Docker :

```bash
docker run -d --name astra-pg \
  -e POSTGRES_USER=astra \
  -e POSTGRES_PASSWORD=astra \
  -e POSTGRES_DB=astra_biolink \
  -p 5432:5432 postgres:16-alpine

docker run -d --name astra-redis -p 6379:6379 redis:7-alpine

# MinIO : S3 local, console sur http://localhost:9001
docker run -d --name astra-minio \
  -e MINIO_ROOT_USER=astra \
  -e MINIO_ROOT_PASSWORD=astra12345 \
  -p 9000:9000 -p 9001:9001 \
  quay.io/minio/minio server /data --console-address ":9001"
```

Avec MinIO, créez le bucket `astra-biolink-media` depuis la console, puis
dans `.env` :

```ini
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="astra-biolink-media"
S3_ACCESS_KEY_ID="astra"
S3_SECRET_ACCESS_KEY="astra12345"
S3_PUBLIC_HOST="localhost:9000/astra-biolink-media"
S3_FORCE_PATH_STYLE="true"   # requis par MinIO
```

### 3. Configuration

```bash
cp .env.example .env
```

Générez les deux secrets JWT — l'app refuse de démarrer si l'un fait moins de
32 caractères :

```bash
echo "JWT_ACCESS_SECRET=\"$(openssl rand -base64 48)\""
echo "JWT_REFRESH_SECRET=\"$(openssl rand -base64 48)\""
```

En développement, `SMTP_HOST` peut rester vide : les emails de vérification
sont alors écrits dans la console au lieu d'être envoyés. Le lien de
vérification est cliquable depuis le terminal.

### 4. Base de données

```bash
npm run db:migrate   # applique le schéma Prisma
npm run db:seed      # slugs réservés + compte admin
```

`db:seed` crée le compte défini par les variables `SEED_ADMIN_*`. **Changez
son mot de passe à la première connexion.**

Alternative sans Prisma — `sql/001_init.sql` contient le schéma complet, y
compris les triggers de quota :

```bash
psql "$DATABASE_URL" -f sql/001_init.sql
```

### 5. Lancement

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (génère le client Prisma) |
| `npm start` | Serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Applique les migrations (dev) |
| `npm run db:deploy` | Applique les migrations (production) |
| `npm run db:studio` | Explorateur de base Prisma |
| `npm run db:seed` | Seed idempotent |

## Historique des emails (EmailLog)

Chaque email que le système tente d'envoyer (vérification, reset de mot de
passe, suspension, levée de suspension, 2FA) est tracé dans la table
`email_logs` : destinataire, type, statut (`PENDING` / `SENT` / `FAILED`),
sujet, date, et erreur éventuelle. Tout passe par le service centralisé
`src/lib/mail.ts` — aucune route n'appelle Nodemailer directement.

**Confidentialité** : on ne stocke jamais les tokens de vérification ou de
reset, les mots de passe, ni le contenu des emails. L'historique sert au debug
et à l'audit, pas à rejouer les liens.

L'historique se consulte dans le **panel admin → Emails** (réservé aux admins).

## Architecture

```
astra/
├── prisma/
│   ├── schema.prisma          # Schéma de données
│   └── seed.ts                # Slugs réservés + compte admin
├── sql/
│   └── 001_init.sql           # Schéma SQL + triggers de quota
├── docs/
│   └── API.md                 # Tableau complet des endpoints
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css        # Thème des panels (≠ thème des pages publiques)
│   │   ├── page.tsx           # Landing
│   │   ├── (auth)/            # Login, inscription, reset      — étape 2
│   │   ├── (panel)/           # Éditeur, stats, paramètres     — étape 5
│   │   ├── (admin)/           # Panel admin                    — étape 6
│   │   ├── [slug]/            # Page publique                  — étape 4
│   │   └── api/               # Route handlers                 — étapes 2-7
│   ├── components/
│   │   ├── ui/                # Primitives partagées
│   │   ├── blocks/            # Rendu des blocks               — étape 4
│   │   └── editor/            # Éditeur + live preview         — étape 5
│   └── lib/
│       ├── env.ts             # Validation des variables d'env
│       ├── db.ts              # Client Prisma
│       ├── redis.ts           # Client Redis + clés
│       ├── s3.ts              # Presign, contraintes par type de média
│       ├── api.ts             # Contrat de réponse, erreurs
│       ├── rate-limit.ts      # Anti-bruteforce
│       ├── auth/
│       │   ├── password.ts    # Argon2id + politique de mot de passe
│       │   └── tokens.ts      # JWT, refresh tokens, tokens à usage unique
│       ├── blocks/
│       │   ├── types.ts       # Contrat d'un type de block
│       │   ├── registry.ts    # ← point d'extension
│       │   └── definitions/   # Un fichier par type de block
│       └── schemas/
│           ├── theme.ts       # Forme de themeConfig
│           └── slug.ts        # Validation et disponibilité des slugs
└── .env.example
```

## Ajouter un type de block

C'est le point d'extension principal, et il ne demande aucune migration :
`blocks.type` est un `VARCHAR` et `blocks.config` un `JSONB`. C'est le
registry, pas la base, qui définit ce qui est valide.

1. Créer `src/lib/blocks/definitions/mon-widget.ts` : un schéma zod dont
   **chaque champ a un `.default()`**, plus les métadonnées (libellé,
   catégorie, `maxPerBiolink`).
2. L'importer dans `src/lib/blocks/registry.ts` et l'ajouter au tableau
   `DEFINITIONS`.
3. Écrire son composant de rendu et l'enregistrer dans le renderer.

L'éditeur, le catalogue et la landing le reprennent automatiquement : ils
lisent tous le registry.

Le `.default()` sur chaque champ n'est pas une coquetterie. Un champ requis
ajouté après coup ferait échouer le parse de tous les blocks déjà en base — le
registry lève au démarrage si une définition n'a pas de config par défaut
valide, précisément pour attraper ça avant la production.

## Sécurité

**Mots de passe.** Argon2id, paramètres OWASP 2024 (19 Mio, t=2, p=1). Pas
bcrypt : il tronque au-delà de 72 octets et n'a pas de coût mémoire, ce qui le
rend bien plus rentable à attaquer sur GPU.

**Sessions.** Access token JWT de 15 min, refresh token opaque de 30 j adossé
à une ligne `sessions`. Le refresh token n'est pas un JWT parce qu'un JWT ne se
révoque pas sans liste noire — c'est-à-dire sans refaire une table de
sessions. Ici, supprimer la ligne coupe l'accès : la déconnexion à distance est
réellement effective, à l'expiration de l'access token près.

**Stockage des tokens.** Refresh tokens et tokens à usage unique sont hashés en
SHA-256 (pas Argon2 : 32 octets aléatoires n'ont rien à craindre d'un
dictionnaire, et il faut pouvoir les retrouver par index). Une fuite de la base
ne permet de rejouer aucune session.

**Énumération de comptes.** Le login applique un hash factice quand
l'identifiant n'existe pas, pour égaliser le temps de réponse. `password/forgot`
répond la même chose que l'email existe ou non.

**Pseudos : casse préservée, comparaison insensible.** `username` garde la
casse saisie (« Olgy » s'affiche « Olgy »), et `username_lower` — dérivé à
l'écriture — porte l'unicité et sert aux recherches de connexion. Colonne
dédiée plutôt qu'un `WHERE lower(username) = ...`, qui n'utiliserait pas
l'index. Sans ce mécanisme, s'inscrire sous « Olgy » puis se connecter en
tapant « olgy » échoue, et « Olgy » / « olgy » peuvent coexister comme deux
comptes indiscernables.

**Uploads.** Liste blanche de types MIME, jamais de liste noire. Le SVG est
exclu de tous les types d'image : il embarque du script et serait servi depuis
notre domaine.

**Embeds.** Les blocks d'embed stockent une plateforme et un identifiant
validés par regex, jamais une URL. L'iframe est reconstruite au rendu depuis
une base connue.

**Rate limiting.** Fenêtre fixe sur Redis. Fail-open si Redis tombe : une panne
de cache ne doit pas rendre le site inaccessible, et les autres protections
(Argon2 lent, captcha après N échecs) restent en place.

**Politique de mot de passe et hachage sont deux modules séparés.**
`password-policy.ts` (schéma zod, jauge de force) est importable côté client ;
`password.ts` (Argon2) porte `server-only`. Les fusionner ferait entrer le
binding natif Argon2 dans le bundle navigateur, où il ne se résout pas — et
l'erreur ne casse pas seulement la jauge, elle casse toute la page.

**Le second facteur ne se contourne pas par le jeton de défi.** `/login`
renvoie un JWT d'audience `astra.is-a.dev/2fa` quand la 2FA est active ; il prouve
seulement que le mot de passe a été validé. `verifyAccessToken` épingle
l'audience `astra.is-a.dev/api` et rejette ce jeton, donc le présenter comme session
ne donne aucun accès.

**Quota de pages.** Limite de 1 page par défaut pour un membre, ajustable par
compte depuis le panel admin (`users.page_limit`), illimitée pour un admin.
Vérifié côté API *et* par un trigger Postgres : le contrôle applicatif
« compter puis insérer » laisse passer deux créations concurrentes, le
`BEFORE INSERT` ferme la fenêtre dans la transaction. Le seul chemin qui
contourne le quota est `POST /api/admin/biolinks`, journalisé dans
`admin_logs`.

## API

Tableau complet des endpoints : [`docs/API.md`](docs/API.md).

## État d'avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations : scaffold, schéma, SQL, registry, lib | ✅ |
| 2 | Auth : inscription, vérif email, JWT, 2FA, Discord | ✅ |
| 3 | API biolinks, links, blocks, médias | ✅ |
| 4 | Page publique `/[slug]` | ✅ |
| 5 | Panel membre + éditeur live | ✅ |
| 6 | Panel admin | ✅ |
| 7 | Présence Discord, analytics | ✅ |
| 8 | EmailLog : historique des emails système + panel admin | ✅ |
| 9 | Migrations Prisma versionnées + préparation Vercel/B2 | ⏳ |
