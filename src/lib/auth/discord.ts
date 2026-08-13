import { randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Client OAuth2 Discord.
 *
 * Portée demandée : `identify` seulement. Pas `email` : on ne veut pas d'une
 * adresse qu'on n'a pas vérifiée nous-mêmes et qui pourrait entrer en
 * collision avec un compte existant. Pas `guilds` : la présence temps réel
 * (étape 7) passe par un bot, pas par le token de l'utilisateur.
 */

const DISCORD_API = "https://discord.com/api/v10";
const OAUTH_AUTHORIZE = "https://discord.com/oauth2/authorize";
const OAUTH_TOKEN = `${DISCORD_API}/oauth2/token`;

export const DISCORD_STATE_COOKIE = "astra_discord_state";

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/auth/discord/callback`;
}

/**
 * Génère le paramètre `state`.
 *
 * Il est stocké en cookie et recomparé au retour. C'est la protection CSRF de
 * l'OAuth : sans lui, un attaquant peut faire aboutir *son* callback dans le
 * navigateur de la victime et lier son compte Discord au compte de la
 * victime — ou l'inverse. Ce n'est pas théorique, c'est la faille OAuth la
 * plus courante.
 */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: serverEnv().DISCORD_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "identify",
    state,
    // Force l'écran de consentement : sans ça, Discord réutilise
    // silencieusement une autorisation précédente, et l'utilisateur qui
    // voulait changer de compte se retrouve relié à l'ancien.
    prompt: "consent",
  });

  return `${OAUTH_AUTHORIZE}?${params}`;
}

export type DiscordProfile = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
};

type TokenResponse = { access_token?: string; error?: string };

type UserResponse = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

/**
 * Échange le code d'autorisation contre un profil.
 * Retourne null si l'échange échoue, quelle qu'en soit la raison.
 */
export async function exchangeCodeForProfile(
  code: string
): Promise<DiscordProfile | null> {
  const env = serverEnv();

  try {
    const tokenResponse = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID!,
        client_secret: env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!tokenResponse.ok) {
      console.error("[discord] échange du code échoué :", tokenResponse.status);
      return null;
    }

    const token = (await tokenResponse.json()) as TokenResponse;
    if (!token.access_token) return null;

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!userResponse.ok) {
      console.error("[discord] lecture du profil échouée :", userResponse.status);
      return null;
    }

    const profile = (await userResponse.json()) as UserResponse;

    return {
      id: profile.id,
      username: profile.username,
      globalName: profile.global_name ?? null,
      avatarUrl: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=256`
        : null,
    };
  } catch (error) {
    console.error("[discord] OAuth indisponible :", error);
    return null;
  }
}

/**
 * Dérive un pseudo libre à partir du pseudo Discord.
 *
 * Les pseudos Discord acceptent des caractères que notre `usernameSchema`
 * refuse (points, tirets, unicode), et peuvent déjà être pris chez nous. On
 * nettoie, puis on suffixe jusqu'à trouver une place.
 */
export function sanitizeDiscordUsername(discordUsername: string): string {
  const cleaned = discordUsername
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 28);

  // Un pseudo Discord entièrement non-latin (cyrillique, kanji) peut donner
  // une chaîne vide ou trop courte après nettoyage.
  return cleaned.length >= 3 ? cleaned : `user${randomBytes(3).toString("hex")}`;
}
