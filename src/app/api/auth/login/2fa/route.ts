import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { verifyChallengeToken } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { findBackupCode, verifyEncryptedTotpCode } from "@/lib/auth/totp";
import { twoFactorLoginSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/login/2fa
 *
 * Second facteur. Accepte un code TOTP à 6 chiffres ou un code de secours.
 * Exige le jeton de défi émis par /login, qui prouve que le mot de passe a
 * déjà été validé.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const ip = clientIp(request);
  await enforce("login", ip);

  const input = await parseBody(request, twoFactorLoginSchema);

  const userId = await verifyChallengeToken(input.challengeToken);

  if (!userId) {
    throw new ApiError(
      "UNAUTHENTICATED",
      "Votre session de connexion a expiré. Reprenez depuis le début."
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new ApiError("UNAUTHENTICATED", "Double authentification introuvable.");
  }

  if (user.status === "BANNED") {
    throw new ApiError("ACCOUNT_BANNED", "Ce compte a été banni.");
  }

  // Le rate limit est aussi appliqué par utilisateur : sans ça, un attaquant
  // qui a le mot de passe pourrait répartir ses essais sur plusieurs IP pour
  // brute-forcer les 6 chiffres.
  await enforce("login", `2fa:${user.id}`);

  const totpValid = verifyEncryptedTotpCode(
    user.twoFactorSecret,
    input.code,
    user.username
  );

  let usedBackupCode = false;

  if (!totpValid) {
    const index = findBackupCode(user.twoFactorBackupCodes, input.code);

    if (index === -1) {
      throw new ApiError("UNAUTHENTICATED", "Code incorrect.");
    }

    // Un code de secours est à usage unique : on le retire immédiatement,
    // avant même d'ouvrir la session. En cas d'échec plus loin, un code
    // consommé pour rien vaut mieux qu'un code rejouable.
    const remaining = user.twoFactorBackupCodes.filter((_, i) => i !== index);

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: remaining },
    });

    usedBackupCode = true;
  }

  await createSession(user, {
    userAgent: request.headers.get("user-agent"),
    ipAddress: ip,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const backupCodesLeft = usedBackupCode
    ? user.twoFactorBackupCodes.length - 1
    : user.twoFactorBackupCodes.length;

  return ok({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    usedBackupCode,
    backupCodesLeft,
    // Prévenir avant la panne sèche : à zéro code et téléphone perdu, le
    // compte devient inaccessible.
    warning:
      usedBackupCode && backupCodesLeft <= 2
        ? `Il ne vous reste que ${backupCodesLeft} code(s) de secours. Régénérez-en depuis vos paramètres.`
        : undefined,
  });
});
