# API Astra Biolink

REST, sous `/api`. Choix de REST plutôt que GraphQL : la surface est petite et
figée, les consommateurs sont l'éditeur et la page publique, et le cache HTTP
sur `GET /api/public/*` est gratuit — trois arguments qui tombent avec GraphQL
pour un gain de flexibilité dont on n'a pas l'usage ici.

## Conventions

**Réponses.** Toutes les réponses ont la même forme, discriminée par `ok` :

```jsonc
// Succès
{ "ok": true, "data": { } }

// Échec
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": ["…"] } } }
```

**Authentification.** Cookies `httpOnly`, `Secure`, `SameSite=Lax`.
`astra_at` porte l'access token JWT (15 min), `astra_rt` le refresh token
opaque (30 j, restreint au chemin `/api/auth`). Aucun token n'est lisible en
JavaScript : c'est ce qui rend un XSS incapable de voler la session.

**Codes d'erreur.**

| Code | HTTP | Sens |
|---|---|---|
| `BAD_REQUEST` | 400 | JSON malformé |
| `VALIDATION_ERROR` | 422 | Champs invalides, détail dans `fields` |
| `UNAUTHENTICATED` | 401 | Token absent, invalide ou expiré |
| `TWO_FACTOR_REQUIRED` | 401 | Identifiants bons, code 2FA attendu |
| `EMAIL_NOT_VERIFIED` | 403 | Email non vérifié |
| `FORBIDDEN` | 403 | Authentifié mais pas autorisé |
| `QUOTA_EXCEEDED` | 403 | Limite de biolinks du compte atteinte |
| `CAPTCHA_REQUIRED` | 403 | Trop d'échecs, captcha exigé |
| `ACCOUNT_SUSPENDED` | 403 | Compte suspendu temporairement |
| `ACCOUNT_BANNED` | 403 | Compte banni |
| `NOT_FOUND` | 404 | Ressource inexistante ou non visible |
| `CONFLICT` | 409 | Slug pris, limite d'instances de block |
| `PAYLOAD_TOO_LARGE` | 413 | Fichier au-delà de la limite du type |
| `RATE_LIMITED` | 429 | Quota dépassé, voir `X-RateLimit-Reset` |
| `INTERNAL_ERROR` | 500 | Erreur serveur, message volontairement opaque |

**Colonne « Auth ».** `—` public · `Session` authentifié ·
`Vérifié` authentifié + email vérifié · `Admin` rôle ADMIN ·
`Propriétaire` propriétaire de la ressource ou admin.

---

## Authentification — `/api/auth` (étape 2)

| Méthode | Endpoint | Auth | Rôle | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | — | Inscription : pseudo, email, mot de passe. Envoie l'email de vérification. | 5 / h / IP |
| `POST` | `/api/auth/login` | — | Connexion. Renvoie `TWO_FACTOR_REQUIRED` si la 2FA est active. | 10 / 5 min / IP |
| `POST` | `/api/auth/login/2fa` | — | Valide le code TOTP et ouvre la session. | 10 / 5 min / IP |
| `POST` | `/api/auth/logout` | Session | Ferme la session courante. | — |
| `POST` | `/api/auth/refresh` | Cookie `astra_rt` | Rotation du refresh token, nouvel access token. | 60 / 5 min / IP |
| `GET` | `/api/auth/me` | Session | Utilisateur courant + rôle + biolinks possédés. | — |
| `POST` | `/api/auth/verify-email` | — | Consomme le token reçu par email. | 10 / h / IP |
| `POST` | `/api/auth/verify-email/resend` | Session | Renvoie l'email de vérification. | 3 / h / compte |
| `POST` | `/api/auth/password/forgot` | — | Envoie le lien de réinitialisation. Réponse identique que l'email existe ou non. | 3 / h / IP |
| `POST` | `/api/auth/password/reset` | — | Consomme le token, change le mot de passe, révoque toutes les sessions. | 5 / h / IP |
| `POST` | `/api/auth/password/change` | Session | Change le mot de passe (ancien exigé). | 5 / h / compte |
| `POST` | `/api/auth/password/set` | Session | Définit un premier mot de passe (compte créé via Discord). Refusé si un mot de passe existe. | 5 / h / compte |
| `GET` | `/api/auth/sessions` | Session | Liste des appareils connectés. | — |
| `DELETE` | `/api/auth/sessions/:id` | Propriétaire | Déconnexion à distance d'un appareil. | — |
| `DELETE` | `/api/auth/sessions` | Session | Déconnecte tous les autres appareils. | — |
| `GET` | `/api/auth/discord` | — | Redirige vers le consentement Discord. | 20 / h / IP |
| `GET` | `/api/auth/discord/callback` | — | Callback OAuth : lie ou crée le compte. | 20 / h / IP |
| `DELETE` | `/api/auth/discord` | Session | Délie Discord. Refusé si c'est le seul moyen de connexion. | — |
| `POST` | `/api/auth/2fa/setup` | Vérifié | Génère le secret TOTP et le QR code. | 5 / h / compte |
| `POST` | `/api/auth/2fa/enable` | Vérifié | Active la 2FA après validation d'un code. Renvoie les codes de secours. | 5 / h / compte |
| `POST` | `/api/auth/2fa/disable` | Vérifié | Désactive la 2FA (mot de passe exigé). | 5 / h / compte |

## Biolinks — `/api/biolinks` (étape 3)

| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| `GET` | `/api/biolinks` | Session | Biolinks de l'utilisateur + `quota` (max, utilisé, `canCreateMore`). Un admin est illimité, un membre est limité par son `pageLimit` (1 par défaut). |
| `POST` | `/api/biolinks` | Vérifié | Crée un biolink. **`QUOTA_EXCEEDED` si le compte a atteint sa limite.** |
| `GET` | `/api/biolinks/:id` | Propriétaire | Biolink complet : thème, liens, blocks, médias. |
| `PATCH` | `/api/biolinks/:id` | Propriétaire | Met à jour titre, description, thème, SEO, publication ; réconcilie aussi les listes complètes de liens et de blocks (création, mise à jour, suppression, ordre). |
| `DELETE` | `/api/biolinks/:id` | Propriétaire | Supprime le biolink et ses médias S3. |
| `POST` | `/api/biolinks/:id/slug` | Propriétaire | Change le slug. Vérifie réservations et unicité. |
| `POST` | `/api/biolinks/:id/password` | Propriétaire | Active ou change le mot de passe de la page. |
| `DELETE` | `/api/biolinks/:id/password` | Propriétaire | Retire la protection. |
| `POST` | `/api/biolinks/:id/template` | Propriétaire | Applique un template. **Écrase le thème en place.** |
| `GET` | `/api/slugs/check?slug=` | — | Disponibilité d'un slug + suggestions. Indicatif : l'unicité est garantie par la base, pas par cet appel. |

## Liens — `/api/biolinks/:id/links` (étape 3)

| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| `GET` | `/api/biolinks/:id/links` | Propriétaire | Liens ordonnés par `position`. |
| `POST` | `/api/biolinks/:id/links` | Propriétaire | Ajoute un lien en fin de liste. |
| `PATCH` | `/api/biolinks/:id/links/:linkId` | Propriétaire | Modifie label, URL, icône, activation. |
| `DELETE` | `/api/biolinks/:id/links/:linkId` | Propriétaire | Supprime le lien. |
| `PUT` | `/api/biolinks/:id/links/order` | Propriétaire | Réordonne. Prend la liste complète des IDs, transactionnel. |

## Blocks — `/api/biolinks/:id/blocks` (étape 3)

| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| `GET` | `/api/blocks/catalog` | Session | Types disponibles, filtrés par rôle. Alimente le sélecteur de l'éditeur. |
| `GET` | `/api/biolinks/:id/blocks` | Propriétaire | Blocks ordonnés par `position`. |
| `POST` | `/api/biolinks/:id/blocks` | Propriétaire | Ajoute un block. Config par défaut du registry, limite d'instances vérifiée. |
| `PATCH` | `/api/biolinks/:id/blocks/:blockId` | Propriétaire | Modifie le config. Validé par le schéma zod du type. |
| `DELETE` | `/api/biolinks/:id/blocks/:blockId` | Propriétaire | Supprime le block. |
| `PUT` | `/api/biolinks/:id/blocks/order` | Propriétaire | Réordonne, transactionnel. |

## Médias — `/api/media` (étape 3)

| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| `POST` | `/api/media/presign` | Vérifié | URL S3 présignée. Valide type MIME et taille **avant** de signer. Rate limit 30 / h. |
| `POST` | `/api/media/confirm` | Vérifié | Enregistre l'asset après upload réussi. Vérifie que l'objet existe vraiment. |
| `GET` | `/api/media` | Session | Médias de l'utilisateur, filtrables par type. |
| `DELETE` | `/api/media/:id` | Propriétaire | Supprime l'asset en base et sur S3. |

## Page publique — `/api/public` (étape 4)

| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| `GET` | `/api/public/:slug` | — | Données de rendu. **404 si non publié.** Le thème est renvoyé sans les champs privés. Cache Redis 60 s. |
| `POST` | `/api/public/:slug/unlock` | — | Vérifie le mot de passe de la page. Rate limit 10 / 5 min / IP. |
| `POST` | `/api/public/:slug/view` | — | Enregistre une vue. Dédoublonnage par empreinte de visiteur sur 24 h. |
| `POST` | `/api/public/:slug/click` | — | Enregistre un clic sur un lien. |
| `POST` | `/api/public/:slug/report` | — | Signale la page. Rate limit 5 / h / IP. |

## Panel membre — `/api/me` (étape 5)

| Méthode | Endpoint | Auth | Rôle |
|---|---|---|---|
| `GET` | `/api/me/stats?biolinkId=&range=` | Propriétaire | Vues, clics par lien, provenance, appareils. |
| `GET` | `/api/me/dashboard` | Session | Jalons, actions recommandées, progression. |
| `PATCH` | `/api/me` | Session | Change email (revérification) ou pseudo. |
| `GET` | `/api/me/export` | Session | Export RGPD complet en JSON. Rate limit 1 / 24 h. |
| `DELETE` | `/api/me` | Session | Supprime le compte (mot de passe exigé). Purge S3 comprise. |
| `GET` | `/api/templates` | Session | Templates officiels et communautaires approuvés. |

## Panel admin — `/api/admin` (étape 6)

Toutes ces routes exigent `role = ADMIN` et écrivent dans `admin_logs`.

| Méthode | Endpoint | Rôle |
|---|---|---|
| `GET` | `/api/admin/stats` | Dashboard : utilisateurs, biolinks actifs, vues, inscriptions par jour. |
| `GET` | `/api/admin/users?q=&role=&status=&page=` | Recherche paginée. |
| `GET` | `/api/admin/users/:id` | Fiche complète : biolinks, sessions, signalements, limite de pages. |
| `PATCH` | `/api/admin/users/:id/role` | Change le rôle. **Refusé si le passage ADMIN → MEMBER laisse plus de biolinks que la limite du compte.** |
| `PATCH` | `/api/admin/users/:id/limit` | Fixe la limite de pages du compte (`pageLimit`, ou `null` pour la défaut). **Refusé si la limite passe sous le nombre de pages existantes.** |
| `POST` | `/api/admin/users/:id/ban` | Bannit, dépublie ses pages, révoque ses sessions. |
| `POST` | `/api/admin/users/:id/suspend` | Suspend jusqu'à une date. |
| `POST` | `/api/admin/users/:id/unban` | Lève la sanction. |
| `POST` | `/api/admin/users/:id/reset-password` | Force un reset par email. |
| `DELETE` | `/api/admin/users/:id/sessions` | Déconnecte tous ses appareils. |
| `POST` | `/api/admin/biolinks` | Crée un biolink pour un compte tiers. **Seul chemin qui contourne le quota membre — journalisé.** |
| `GET` | `/api/admin/biolinks?q=&nsfw=&page=` | Recherche parmi tous les biolinks. |
| `PATCH` | `/api/admin/biolinks/:id` | Force la dépublication ou le marquage NSFW. |
| `DELETE` | `/api/admin/biolinks/:id` | Supprime n'importe quel biolink. |
| `GET` | `/api/admin/reports?status=` | File de modération. |
| `PATCH` | `/api/admin/reports/:id` | Traite un signalement. |
| `GET` | `/api/admin/slugs` | Slugs réservés et premium. |
| `POST` | `/api/admin/slugs` | Réserve un slug. |
| `DELETE` | `/api/admin/slugs/:slug` | Libère un slug. |
| `POST` | `/api/admin/slugs/:slug/grant` | Attribue un slug premium à un compte. |
| `GET` | `/api/admin/templates` | Tous les templates, approuvés ou non. |
| `POST` | `/api/admin/templates` | Crée un template officiel. |
| `PATCH` | `/api/admin/templates/:id` | Approuve, modifie ou retire. |
| `GET` | `/api/admin/logs?adminId=&action=&page=` | Journal d'audit. **Lecture seule : aucune route ne permet d'en effacer une ligne.** |

---

## Notes de conception

**Le quota de biolinks est vérifié à trois endroits.** Le front masque le
bouton, l'API compte avant d'insérer, et un trigger Postgres
(`biolinks_enforce_member_quota`) refuse l'INSERT. Les deux premiers sont du
confort ; seul le troisième tient face à deux requêtes concurrentes, où le
« compter puis insérer » applicatif laisse passer deux créations. La limite
est de 1 par défaut, ajustable par compte via `users.page_limit` (panel
admin) ; un admin est toujours illimité. Voir `sql/001_init.sql`.

**Le réordonnancement prend la liste complète, pas un delta.** Envoyer
« déplacer B en position 2 » oblige le serveur à recalculer les positions des
voisins, et deux déplacements simultanés se marchent dessus. Envoyer l'ordre
final complet rend l'opération idempotente et rejouable.

**Aucune URL fournie par l'utilisateur n'atterrit dans un `src` d'iframe.**
Les blocks d'embed stockent une plateforme et un identifiant validés par
regex ; l'URL est reconstruite au rendu depuis une base connue. C'est ce qui
sépare un embed Spotify d'un XSS.

**Les tokens sont hashés en base.** Refresh tokens et tokens à usage unique
sont stockés en SHA-256. Une fuite de la base ne permet de rejouer aucune
session ni aucun lien de réinitialisation.
