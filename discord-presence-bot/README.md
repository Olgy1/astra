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

## 4. Héberger gratuitement et 24/7 (Render, sans carte)

Render offre des **instances gratuites** (inscription par email, **aucune carte
bancaire**). Leur seule particularité : elles s'endorment après 15 min sans
trafic entrant. On la contourne avec un **ping de garde gratuit** (UptimeRobot,
5 min d'intervalle) : l'instance ne dort jamais, le bot reste connecté au
gateway 24/7, et les 750 h gratuites de Render couvrent exactement un mois de
fonctionnement continu.

### 4.1 Créer le service (dashbord Render, ~5 min)

1. **render.com** → **Sign up** (email ou compte Google — pas de carte).
2. Dashboard → **New +** → **Blueprint** → connecte ton **GitHub** (autorise
   Render) → choisis le dépôt **astra** → **Apply Blueprint**.
   Render lit `discord-presence-bot/render.yaml` et crée le service
   **astra-presence** tout seul.
3. Va sur le service **astra-presence** → **Environment** → **Add Environment
   Variable** → `DISCORD_BOT_TOKEN` = ton token → **Save Changes**.
4. **Manual Deploy** → **Deploy latest commit** (premier déploiement).
5. L'URL du service apparaît dans le dashboard :
   `https://astra-presence.onrender.com` → vérifie avec :
   `curl https://astra-presence.onrender.com/health` → `{ ok: true }`.

### 4.2 Garder l'instance éveillée (ping gratuit, 3 min)

1. **uptimerobot.com** → **Sign up** (email, pas de carte).
2. **Add New Monitor** → type **HTTP(s)** → URL :
   `https://astra-presence.onrender.com/health` → interval **5 minutes** →
   **Create Monitor**.

   Chaque check est une visite qui empêche Render de s'endormir → le bot reste
   connecté en permanence. Bonus : UptimeRobot t'alerte par email si le bot
   tombe.

### 4.3 Alternative sans ping : Fly.io (carte demandée à l'inscription)

Fly.io offre une allocation gratuite (machines qui ne dorment jamais, aucun ping
nécessaire), mais demande une carte bancaire à l'inscription (aucun débit).

```bash
brew install flyctl
cd discord-presence-bot
fly launch --name astra-presence --no-deploy
fly secrets set DISCORD_BOT_TOKEN="ton_token"
fly deploy
```

## 5. Brancher Astra dessus (2 min)

Dans **Vercel → Settings → Environment Variables**, ajoute :

```
DISCORD_PRESENCE_URL = https://astra-presence.onrender.com
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
