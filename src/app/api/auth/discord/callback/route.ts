import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/context";
import { createSession } from "@/lib/auth/session";
import { safeCompare } from "@/lib/auth/tokens";
import {
  DISCORD_STATE_COOKIE,
  exchangeCodeForProfile,
  sanitizeDiscordUsername,
} from "@/lib/auth/discord";

/**
 * GET /api/auth/discord/callback
 *
 * Trois cas :
 *   1. utilisateur connecté       → lie Discord à son compte ;
 *   2. discordId déjà connu       → connecte le compte correspondant ;
 *   3. discordId inconnu          → crée un compte.
 *
 * Cette route redirige (elle est ouverte dans le navigateur), elle ne renvoie
 * pas de JSON. Les erreurs partent en query param vers une page qui les
 * affiche.
 */

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function redirectWithError(code: string): NextResponse {
  return NextResponse.redirect(`${appUrl()}/login?discord_error=${code}`);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await enforce("login", `discord-cb:${clientIp(request)}`);

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // L'utilisateur a cliqué « Annuler » sur l'écran Discord.
    if (error) {
      return NextResponse.redirect(`${appUrl()}/login`);
    }

    if (!code || !state) {
      return redirectWithError("missing_params");
    }

    const store = await cookies();
    const expectedState = store.get(DISCORD_STATE_COOKIE)?.value;

    // Le state est à usage unique, on l'efface quoi qu'il arrive ensuite.
    store.set(DISCORD_STATE_COOKIE, "", {
      httpOnly: true,
      secure: serverEnv().NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 0,
    });

    // Le contrôle qui bloque le CSRF : sans lui, un attaquant peut faire
    // aboutir son propre callback dans le navigateur de la victime et lier
    // son Discord au compte de celle-ci.
    if (!expectedState || !safeCompare(expectedState, state)) {
      return redirectWithError("invalid_state");
    }

    const profile = await exchangeCodeForProfile(code);

    if (!profile) {
      return redirectWithError("exchange_failed");
    }

    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent");

    // --- Cas 1 : liaison à un compte déjà connecté -------------------------
    const currentUser = await getCurrentUser();

    if (currentUser) {
      const alreadyLinked = await prisma.user.findUnique({
        where: { discordId: profile.id },
        select: { id: true },
      });

      if (alreadyLinked && alreadyLinked.id !== currentUser.id) {
        return redirectWithError("discord_already_linked");
      }

      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          discordId: profile.id,
          discordUsername: profile.globalName ?? profile.username,
          discordAvatar: profile.avatarUrl,
        },
      });

      return NextResponse.redirect(`${appUrl()}/panel/settings?discord=linked`);
    }

    // --- Cas 2 : connexion d'un compte existant ----------------------------
    const existing = await prisma.user.findUnique({
      where: { discordId: profile.id },
      select: { id: true, username: true, role: true, status: true },
    });

    if (existing) {
      if (existing.status === "BANNED") {
        return redirectWithError("account_banned");
      }
      if (existing.status === "SUSPENDED") {
        return redirectWithError("account_suspended");
      }

      await createSession(existing, { userAgent, ipAddress: ip });
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          lastLogin: new Date(),
          // Le pseudo et l'avatar Discord changent : on rafraîchit à chaque
          // connexion, sinon la page publique affiche un profil périmé.
          discordUsername: profile.globalName ?? profile.username,
          discordAvatar: profile.avatarUrl,
        },
      });

      return NextResponse.redirect(`${appUrl()}/panel`);
    }

    // --- Cas 3 : l'email Discord correspond à un compte existant -----------
    // L'utilisateur s'est inscrit avec son email, puis se connecte avec
    // Discord : on lie le compte Discord à ce compte au lieu d'en créer un
    // doublon. Sans ce contrôle, la même personne finirait avec deux comptes
    // (un par email, un par Discord) et des pages séparées.
    if (profile.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: profile.email },
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          discordId: true,
        },
      });

      if (byEmail) {
        if (byEmail.status === "BANNED") {
          return redirectWithError("account_banned");
        }
        if (byEmail.status === "SUSPENDED") {
          return redirectWithError("account_suspended");
        }

        // Déjà lié à un autre Discord : la contrainte unique `discordId`
        // l'empêcherait de toute façon ; autant répondre clairement.
        if (byEmail.discordId) {
          return redirectWithError("discord_already_linked");
        }

        await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            discordId: profile.id,
            discordUsername: profile.globalName ?? profile.username,
            discordAvatar: profile.avatarUrl,
            lastLogin: new Date(),
          },
        });

        await createSession(byEmail, { userAgent, ipAddress: ip });

        return NextResponse.redirect(`${appUrl()}/panel`);
      }
    }

    // --- Cas 4 : création d'un compte --------------------------------------
    const created = await createUserFromDiscord(profile);

    if (!created) {
      return redirectWithError("username_unavailable");
    }

    await createSession(created, { userAgent, ipAddress: ip });

    // Le compte n'a pas de mot de passe : on l'envoie immédiatement en créer
    // un, pour qu'il ne dépende pas de Discord pour se connecter.
    return NextResponse.redirect(`${appUrl()}/set-password`);
  } catch (caught) {
    console.error("[discord] callback en échec :", caught);
    return redirectWithError("unexpected");
  }
}

type CreatedUser = { id: string; username: string; role: "MEMBER" | "ADMIN" };

/**
 * Crée un compte depuis un profil Discord.
 *
 * Le pseudo Discord peut être pris chez nous : on suffixe et on réessaie. On
 * s'appuie sur la contrainte unique plutôt que sur un findFirst préalable —
 * entre le contrôle et l'insertion, deux inscriptions concurrentes
 * passeraient toutes les deux.
 */
async function createUserFromDiscord(profile: {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  email: string | null;
}): Promise<CreatedUser | null> {
  const base = sanitizeDiscordUsername(profile.username);

  for (let attempt = 0; attempt < 8; attempt++) {
    const username =
      attempt === 0 ? base : `${base.slice(0, 26)}${Math.floor(Math.random() * 9000 + 1000)}`;

    try {
      return await prisma.user.create({
        data: {
          username,
          // `sanitizeDiscordUsername` produit déjà des minuscules, mais on
          // dérive explicitement : la colonne est NOT NULL et se déduire du
          // comportement d'une autre fonction serait fragile.
          usernameLower: username.toLowerCase(),
          // Discord a vérifié l'adresse avant de nous la renvoyer : on peut
          // la considérer comme confirmée d'emblée. Sans email (cas rare),
          // on pose un placeholder que l'utilisateur remplacera dans ses
          // paramètres — ce qui déclenchera une vraie vérification.
          email: profile.email ?? `discord_${profile.id}@placeholder.astra.is-a.dev`,
          passwordHash: null,
          emailVerified: Boolean(profile.email),
          discordId: profile.id,
          discordUsername: profile.globalName ?? profile.username,
          discordAvatar: profile.avatarUrl,
          role: "MEMBER",
        },
        select: { id: true, username: true, role: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue; // pseudo pris, on retente avec un suffixe
      }
      throw error;
    }
  }

  return null;
}
