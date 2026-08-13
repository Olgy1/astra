import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import {
  clearLoginFailures,
  enforce,
  recordLoginFailure,
} from "@/lib/rate-limit";
import { dummyVerify, verifyPassword } from "@/lib/auth/password";
import { signChallengeToken } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { isCaptchaRequired, verifyCaptcha } from "@/lib/auth/captcha";
import { GENERIC_LOGIN_ERROR, loginSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/login
 *
 * Accepte un pseudo ou un email. Renvoie TWO_FACTOR_REQUIRED avec un jeton de
 * défi si la 2FA est active.
 *
 * Trois protections cohabitent, et chacune a un rôle distinct :
 *   - le rate limit par IP plafonne le débit d'une attaque ;
 *   - le compteur d'échecs par identifiant déclenche le captcha, qui rend
 *     l'automatisation coûteuse ;
 *   - le hash factice égalise le temps de réponse, pour que l'échec ne
 *     révèle pas si le compte existe.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const ip = clientIp(request);
  await enforce("login", ip);

  const input = await parseBody(request, loginSchema);
  const identifier = input.identifier.toLowerCase();

  if (await isCaptchaRequired(identifier)) {
    const captcha = await verifyCaptcha(input.captchaToken, ip);
    if (!captcha.ok) {
      throw new ApiError(
        "CAPTCHA_REQUIRED",
        "Trop de tentatives échouées. Validez le captcha pour continuer."
      );
    }
  }

  // `usernameLower` et non `username` : le pseudo est stocké avec sa casse
  // d'origine, mais quelqu'un inscrit sous « Olgy » doit pouvoir se connecter
  // en tapant « olgy », « OLGY » ou « Olgy ». `identifier` est déjà en
  // minuscules, tout comme `email` en base.
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { usernameLower: identifier }],
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      statusReason: true,
      suspendedUntil: true,
      passwordHash: true,
      twoFactorEnabled: true,
    },
  });

  // Compte inconnu, ou compte sans mot de passe (créé via Discord) : on
  // consomme quand même le temps d'un vrai hash avant de répondre. Sans ça,
  // un attaquant distingue les comptes existants au chronomètre — la réponse
  // arriverait en 1 ms au lieu de 50.
  if (!user || !user.passwordHash) {
    await dummyVerify(input.password);
    await recordLoginFailure(identifier);
    throw new ApiError("UNAUTHENTICATED", GENERIC_LOGIN_ERROR);
  }

  const passwordValid = await verifyPassword(user.passwordHash, input.password);

  if (!passwordValid) {
    await recordLoginFailure(identifier);
    throw new ApiError("UNAUTHENTICATED", GENERIC_LOGIN_ERROR);
  }

  // Le statut n'est vérifié qu'après validation du mot de passe : annoncer
  // « ce compte est banni » à qui ne connaît pas le mot de passe révélerait
  // l'existence du compte.
  if (user.status === "BANNED") {
    throw new ApiError(
      "ACCOUNT_BANNED",
      user.statusReason
        ? `Ce compte a été banni : ${user.statusReason}`
        : "Ce compte a été banni."
    );
  }

  if (user.status === "SUSPENDED") {
    const stillSuspended = !user.suspendedUntil || user.suspendedUntil > new Date();

    if (stillSuspended) {
      const until = user.suspendedUntil
        ? ` jusqu'au ${user.suspendedUntil.toLocaleDateString("fr-FR")}`
        : "";
      throw new ApiError(
        "ACCOUNT_SUSPENDED",
        `Ce compte est suspendu${until}.${user.statusReason ? ` Motif : ${user.statusReason}` : ""}`
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", suspendedUntil: null, statusReason: null },
    });
  }

  await clearLoginFailures(identifier);

  if (user.twoFactorEnabled) {
    // Aucune session n'est ouverte à ce stade : le mot de passe seul ne
    // suffit pas, c'est tout l'intérêt du second facteur.
    return ok({
      twoFactorRequired: true as const,
      challengeToken: await signChallengeToken(user.id),
    });
  }

  await createSession(user, {
    userAgent: request.headers.get("user-agent"),
    ipAddress: ip,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  return ok({
    twoFactorRequired: false as const,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});
