import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { isDiscordConfigured, serverEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import {
  authorizeUrl,
  DISCORD_STATE_COOKIE,
  generateState,
} from "@/lib/auth/discord";

/**
 * GET /api/auth/discord
 * Redirige vers le consentement Discord.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await enforce("login", `discord:${clientIp(request)}`);

  if (!isDiscordConfigured()) {
    throw new ApiError(
      "BAD_REQUEST",
      "La connexion Discord n'est pas configurée sur ce serveur."
    );
  }

  const state = generateState();
  const store = await cookies();

  store.set(DISCORD_STATE_COOKIE, state, {
    httpOnly: true,
    secure: serverEnv().NODE_ENV === "production",
    // `lax` et non `strict` : au retour de Discord, un cookie strict ne
    // serait pas envoyé (navigation venant d'un autre site) et le state
    // serait introuvable — le flux échouerait systématiquement.
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600, // 10 min pour consentir, largement suffisant
  });

  return NextResponse.redirect(authorizeUrl(state));
});

/**
 * DELETE /api/auth/discord
 * Délie le compte Discord.
 */
export const DELETE = withErrorHandling(async () => {
  const user = await requireUser();

  if (!user.discordId) {
    throw new ApiError("CONFLICT", "Aucun compte Discord n'est lié.");
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  // Délier Discord d'un compte sans mot de passe le rendrait définitivement
  // inaccessible : il n'y aurait plus aucun moyen de s'y connecter.
  if (!record?.passwordHash) {
    throw new ApiError(
      "CONFLICT",
      "Discord est votre seul moyen de connexion. Définissez d'abord un mot de passe via « mot de passe oublié »."
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { discordId: null, discordUsername: null, discordAvatar: null },
  });

  return ok({
    message:
      "Compte Discord délié. La présence en temps réel n'est plus affichée sur votre page.",
  });
});
