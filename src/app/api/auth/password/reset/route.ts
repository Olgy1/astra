import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { clearLoginFailures, enforce } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { clearSessionCookies } from "@/lib/auth/session";
import { sendPasswordChangedEmail } from "@/lib/mail";
import { resetPasswordSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/password/reset
 *
 * Consomme le token, change le mot de passe, révoque toutes les sessions.
 */
export const POST = withErrorHandling(async (request: Request) => {
  await enforce("passwordReset", clientIp(request));

  const input = await parseBody(request, resetPasswordSchema);

  const token = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: {
      user: { select: { id: true, username: true, email: true, status: true } },
    },
  });

  if (!token || token.type !== "PASSWORD_RESET" || token.usedAt) {
    throw new ApiError(
      "BAD_REQUEST",
      "Ce lien de réinitialisation est invalide ou a déjà été utilisé. Demandez-en un nouveau."
    );
  }

  if (token.expiresAt < new Date()) {
    throw new ApiError(
      "BAD_REQUEST",
      "Ce lien a expiré. Demandez-en un nouveau depuis la page de connexion."
    );
  }

  if (token.user.status === "BANNED") {
    throw new ApiError("ACCOUNT_BANNED", "Ce compte a été banni.");
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: {
        passwordHash,
        // Réinitialiser son mot de passe depuis un lien reçu par email prouve
        // qu'on contrôle la boîte : autant en profiter pour valider l'adresse
        // si elle ne l'était pas.
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.verificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    // Toutes les sessions tombent, y compris celles de l'attaquant éventuel.
    // C'est le point du reset : si quelqu'un d'autre était connecté, il ne
    // l'est plus.
    prisma.session.deleteMany({ where: { userId: token.userId } }),
  ]);

  await clearLoginFailures(token.user.email);
  await clearLoginFailures(token.user.username);
  await clearSessionCookies();

  await sendPasswordChangedEmail(token.user.id, token.user.email, token.user.username);

  return ok({
    message: "Mot de passe modifié. Toutes vos sessions ont été fermées, reconnectez-vous.",
  });
});
