#!/usr/bin/env node
/**
 * Astra — bot de présence Discord.
 *
 * Connecte un bot Discord au gateway officiel (WebSocket) avec les intents
 * de présence, garde en mémoire la présence des membres des serveurs qu'il
 * partage, et expose une petite API HTTP au même format que Lanyard :
 *
 *   GET /health           → { ok: true, tracked: <nombre d'utilisateurs> }
 *   GET /<discordId>      → { success: true, data: { discord_status, ... } }
 *
 * Le site Astra appelle cette API (variable DISCORD_PRESENCE_URL) pour
 * afficher le statut « en ligne » sur les pages bio — sans dépendre du
 * service public Lanyard.
 *
 * Variables d'environnement :
 *   DISCORD_BOT_TOKEN  (obligatoire) — token du bot (Discord Developer Portal)
 *   PORT               (défaut 8787) — port du serveur HTTP
 *
 * Limite de la plateforme (incontournable) : Discord n'autorise un bot à
 * voir la présence d'un utilisateur que si les deux partagent un serveur.
 * Concrètement : ce bot montre la présence de TOI (et de toute personne
 * invitée sur le serveur où il se trouve), pas celle d'inconnus.
 */

const http = require("node:http");
const WebSocket = require("ws");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = Number(process.env.PORT || 8787);
const API_BASE = "https://discord.com/api/v10";
const GATEWAY_VERSION = 10;

// Intents : GUILDS (1<<0) + GUILD_MEMBERS (1<<1) + GUILD_PRESENCES (1<<8).
// Les deux derniers sont « privilégiés » : à activer dans le portail
// développeur (Bot → Privileged Gateway Intents).
const INTENTS = (1 << 0) | (1 << 1) | (1 << 8);

// ---------------------------------------------------------------------------
// État en mémoire : discordId → { presence, username }
// ---------------------------------------------------------------------------
const presenceByUser = new Map();

function normalizePresence(payload) {
  const status = payload.status || "offline";

  const spotifyActivity = (payload.activities || []).find(
    (activity) => activity.type === 2 && activity.name === "Spotify"
  );

  let spotify = null;
  if (spotifyActivity) {
    const largeImage = spotifyActivity.assets?.large_image || "";
    const albumArtId = largeImage.startsWith("spotify:") ? largeImage.slice("spotify:".length) : null;
    spotify = {
      song: spotifyActivity.details || null,
      artist: spotifyActivity.state || null,
      album_art_url: albumArtId
        ? `https://i.scdn.co/image/${albumArtId}`
        : spotifyActivity.assets?.large_image || null,
      timestamps: spotifyActivity.timestamps || null,
    };
  }

  const activities = (payload.activities || []).map((activity) => ({
    type: activity.type,
    name: activity.name,
    details: activity.details ?? null,
    state: activity.state ?? null,
    assets: activity.assets ?? null,
  }));

  return {
    discord_status: status,
    activities,
    listening_to_spotify: Boolean(spotify),
    spotify,
  };
}

// ---------------------------------------------------------------------------
// Client gateway (connexion persistante + reconnexion automatique)
// ---------------------------------------------------------------------------
let gatewaySocket = null;
let heartbeatTimer = null;
let heartbeatInterval = 0;
let heartbeatAcked = true;
let sessionId = null;
let lastSequence = null;
let reconnectDelayMs = 1000;
let shuttingDown = false;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function logTrackedUsers() {
  const users = [...presenceByUser.entries()].map(
    ([id, entry]) => `${entry.username ?? "?"} (${id})`
  );
  log(`présences suivies (${users.length}) : ${users.join(", ") || "aucune"}`);
}

async function getGatewayUrl() {
  const response = await fetch(`${API_BASE}/gateway/bot`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Impossible de récupérer l'URL du gateway (HTTP ${response.status}) : ${text}`);
  }
  const data = await response.json();
  return data.url;
}

function heartbeat() {
  if (!gatewaySocket || gatewaySocket.readyState !== WebSocket.OPEN) return;
  heartbeatAcked = false;
  gatewaySocket.send(JSON.stringify({ op: 1, d: lastSequence }));
  // Si Discord n'accuse pas réception dans les 2 intervalles, on considère la
  // connexion morte et on la relance.
  setTimeout(() => {
    if (!heartbeatAcked && gatewaySocket && gatewaySocket.readyState === WebSocket.OPEN) {
      log("heartbeat non acquitté — reconnexion");
      gatewaySocket.terminate();
    }
  }, heartbeatInterval * 2);
}

function sendIdentify() {
  gatewaySocket.send(
    JSON.stringify({
      op: 2,
      d: {
        token: TOKEN,
        intents: INTENTS,
        properties: { os: process.platform, browser: "astra-presence-bot", device: "astra-presence-bot" },
        presence: { status: "invisible", afk: false, activities: [], since: null, shard_id: 0, shard_count: 1 },
      },
    })
  );
}

function sendResume() {
  gatewaySocket.send(
    JSON.stringify({
      op: 6,
      d: { token: TOKEN, session_id: sessionId, seq: lastSequence },
    })
  );
}

function requestAllMembers(guildId) {
  // Op 8 « Request Guild Members » avec presences:true : force Discord à
  // renvoyer la présence de tous les membres dès la connexion, y compris les
  // membres hors ligne.
  gatewaySocket.send(
    JSON.stringify({
      op: 8,
      d: { guild_id: guildId, query: "", limit: 0, presences: true },
    })
  );
}

function connectGateway(url) {
  log(`connexion au gateway ${url}${sessionId ? " (resume)" : ""}`);
  gatewaySocket = new WebSocket(url, { handshakeTimeout: 15000 });

  gatewaySocket.on("open", () => {
    reconnectDelayMs = 1000;
    // L'identify (ou le resume) est envoyé à la réception de « hello » (op 10),
    // pas ici : Discord n'accepte rien avant hello.
  });

  gatewaySocket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.s !== null && message.s !== undefined) lastSequence = message.s;

    switch (message.op) {
      case 10: {
        // hello : on lance le heartbeat et on s'identifie.
        heartbeatInterval = message.d.heartbeat_interval;
        clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(heartbeat, heartbeatInterval);
        heartbeat();
        if (sessionId) sendResume();
        else sendIdentify();
        break;
      }
      case 11:
        heartbeatAcked = true;
        break;
      case 7: // reconnect demandé par Discord
        log("reconnect demandé par Discord");
        gatewaySocket.close(4000, "reconnect demandé");
        break;
      case 9: // session invalide
        log("session invalide");
        if (message.d === true) {
          // Session récupérable : on tente un resume.
          connectGateway(url);
        } else {
          // Session perdue : on recommence de zéro.
          sessionId = null;
          lastSequence = null;
          connectGateway(url);
        }
        break;
      case 0: {
        const event = message.t;
        if (event === "READY") {
          sessionId = message.d.session_id;
          lastSequence = message.s;
          log(`connecté en tant que ${message.d.user.username}#${message.d.user.discriminator} — ${presenceByUser.size} présence(s) en cache`);
        } else if (event === "GUILD_CREATE") {
          requestAllMembers(message.d.id);
        } else if (event === "GUILD_MEMBERS_CHUNK") {
          for (const member of message.d.members || []) {
            if (member.presence) {
              presenceByUser.set(member.user.id, {
                presence: normalizePresence(member.presence),
                username: member.user.username ?? null,
              });
            }
          }
          logTrackedUsers();
        } else if (event === "PRESENCE_UPDATE") {
          if (message.d.user?.id) {
            if (message.d.status === "offline" && !message.d.activities?.length) {
              presenceByUser.delete(message.d.user.id);
            } else {
              presenceByUser.set(message.d.user.id, {
                presence: normalizePresence(message.d),
                username: message.d.user.username ?? null,
              });
            }
          }
        }
        break;
      }
    }
  });

  gatewaySocket.on("close", (code) => {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (shuttingDown) return;
    log(`connexion fermée (code ${code}) — reconnexion dans ${reconnectDelayMs}ms`);
    setTimeout(() => connectGateway(url), reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60000);
  });

  gatewaySocket.on("error", (error) => {
    log("erreur gateway :", error.message);
  });
}

// ---------------------------------------------------------------------------
// Serveur HTTP
// ---------------------------------------------------------------------------
function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    response.end();
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      connected: gatewaySocket?.readyState === WebSocket.OPEN,
      tracked: presenceByUser.size,
      users: [...presenceByUser.entries()].map(([id, entry]) => ({
        id,
        username: entry.username,
        status: entry.presence.discord_status,
      })),
    });
    return;
  }

  if (url.pathname === "/") {
    sendJson(response, 200, {
      service: "astra-discord-presence-bot",
      usage: "GET /<discordId> pour la présence, GET /health pour l'état",
      tracked: presenceByUser.size,
    });
    return;
  }

  const match = url.pathname.match(/^\/(\d{15,25})$/);
  if (!match) {
    sendJson(response, 404, { success: false, error: "Route inconnue. Utilisez /<discordId> ou /health." });
    return;
  }

  const entry = presenceByUser.get(match[1]);
  if (!entry) {
    sendJson(response, 200, {
      success: false,
      error: "Cet utilisateur n'est pas suivi : le bot et lui doivent partager un serveur Discord.",
    });
    return;
  }

  sendJson(response, 200, { success: true, data: entry.presence });
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
async function main() {
  if (!TOKEN) {
    console.error("DISCORD_BOT_TOKEN manquant. Définissez-le avant de lancer (voir README.md).");
    process.exit(1);
  }

  const url = await getGatewayUrl();
  connectGateway(url.replace(/\/$/, "") + "/?v=" + GATEWAY_VERSION + "&encoding=json");

  server.listen(PORT, () => {
    log(`API HTTP sur le port ${PORT} — GET /health pour vérifier`);
  });

  const stop = () => {
    shuttingDown = true;
    clearInterval(heartbeatTimer);
    try {
      gatewaySocket?.close(1000, "arrêt");
    } catch {
      /* déjà fermé */
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error("Échec du démarrage :", error);
  process.exit(1);
});
