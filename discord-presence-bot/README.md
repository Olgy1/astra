# Astra — bot de présence Discord

Petit bot qui affiche ton **vrai statut Discord** (en ligne / occupé / AFK /
hors ligne), ton **activité** (jeu, etc.) et ton **Spotify** sur ta page bio —
sans dépendre du service public Lanyard (qui exige de rejoindre leur serveur).

Il se connecte au gateway Discord (WebSocket), garde la présence des membres
en mémoire, et expose une API HTTP :

| Route | Réponse |
|---|---|
| `GET /health` | `{ ok, connected, tracked }` |
| `GET /<discordId>` | `{ success, data: { discord_status, activities, spotify } }` |

> ⚠️ **Limite imposée par Discord (aucune solution ne l'évite)** : un bot ne
> voit la présence d'un utilisateur que s'ils **partagent un serveur**. Ce bot
> montre donc la présence de **toi** (et des personnes que tu invites dans le
> serveur où il est), pas celle d'inconnus. Pour la présence d'utilisateurs
> quelconques, seul Lanyard le permet (eux aussi via un serveur partagé).

---

## 1. Créer le bot (5 min, une seule fois)

1. Ouvre **discord.com/developers/applications** → **New Application** → nomme-le
   `astra` → **Create**.
2. Menu de gauche → **Bot** → section **Privileged Gateway Intents**, active :
   - ✅ **Presence Intent**
   - ✅ **Server Members Intent**
   - (Message Content n'est pas nécessaire.)
3. Toujours dans **Bot** → section **Token** → **Reset Token** → **Copy**.
   ⚠️ Le token ne s'affiche qu'une fois — garde-le précieusement.
   C'est la valeur de `DISCORD_BOT_TOKEN`.

## 2. Inviter le bot dans un serveur (2 min)

1. Menu de gauche → **OAuth2 → URL Generator** :
   - Scopes : coche **`bot`**.
   - Permissions : laisse vide (aucune permission requise).
2. Copie l'URL générée en bas → ouvre-la dans un navigateur → choisis ton
   serveur (créé-en un privé si tu n'en as pas) → **Autoriser**.
3. Ton compte Discord doit être **dans ce serveur** — sinon le bot ne verra pas
   ta présence.

## 3. Lancer en local (test immédiat)

```bash
cd discord-presence-bot
npm install
DISCORD_BOT_TOKEN="ton_token" node index.js
```

Puis, dans un autre terminal :

```bash
curl http://localhost:8787/health
curl http://localhost:8787/<ton_id_discord>
```

Ton ID Discord : Paramètres → Avancé → **Mode développeur** ON → clic droit sur
ton profil → **Copier l'ID utilisateur**.

👉 **En local, ça marche déjà.** Si tu te contentes d'un usage perso et que ton
Mac est souvent allumé, tu peux t'arrêter là (le bot tourne tant que le terminal
est ouvert). Sinon, continue pour l'héberger gratuitement.

## 4. Héberger gratuitement (recommandé : Fly.io)

Fly.io offre une **allocation gratuite** (3 machines 256 MB qui ne s'endorment
pas — parfait pour un bot qui doit rester connecté). Il faut une carte bancaire
pour créer le compte (aucun débit ; uniquement pour vérifier l'identité).

```bash
# 1. Installe flyctl (macOS) :
brew install flyctl

# 2. Connecte-toi et crée l'application (accepte les fichiers existants) :
cd discord-presence-bot
fly launch --name astra-presence --no-deploy

# 3. Dépose le token du bot :
fly secrets set DISCORD_BOT_TOKEN="ton_token"

# 4. Déploie :
fly deploy
```

Ton API est alors à l'adresse **https://astra-presence.fly.dev**.
Vérifie : `curl https://astra-presence.fly.dev/health` → `{ ok: true }`.

> **Alternative — Render (gratuit)** : crée un *Web Service* sur
> render.com avec ce dépôt (Docker), variable `DISCORD_BOT_TOKEN`.
> ⚠️ Les instances gratuites de Render s'endorment après 15 min d'inactivité ;
> la présence sera alors « hors ligne » jusqu'à la prochaine visite. Fly.io est
> nettement mieux pour ce cas précis.

## 5. Brancher Astra dessus (2 min)

Dans **Vercel → Settings → Environment Variables**, ajoute :

```
DISCORD_PRESENCE_URL = https://astra-presence.fly.dev
```

(coché pour **Production**), puis **Redeploy**.

Le site essaie d'abord ton bot ; s'il est injoignable ou que l'utilisateur n'y
est pas suivi, il retombe automatiquement sur Lanyard, puis sur « hors ligne ».

---

## Notes techniques

- Le bot se reconnecte tout seul (heartbeat + resume) et re-demande la présence
  de tous les membres à chaque connexion (`Request Guild Members`, op 8).
- La présence est gardée **en mémoire** : redémarre le bot et le cache se
  reconstruit seul en quelques secondes.
- Aucune donnée n'est écrite sur disque : rien à sauvegarder, rien à purger.
