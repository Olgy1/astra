import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { hashToken } from "@/lib/auth/tokens";
import { verifyEmailSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/verify-email
 *
 * Consomme le token reçu par email. N'exige pas de session : le lien peut
 * être ouvert depuis un autre appareil que celui de l'inscription.
 */
export const POST = withErrorHandling(async (request: Request) => {
  await enforce("emailResend", clientIp(request));

  const input = await parseBody(request, verifyEmailSchema);

  const token = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: {
      user: { select: { id: true, username: true, email: true, emailVerified: true } },
    },
  });

  if (!token || token.type !== "EMAIL_VERIFICATION") {
    throw new ApiError(
      "BAD_REQUEST",
      "Ce lien de vérification est invalide. Demandez-en un nouveau depuis votre compte."
    );
  }

  if (token.usedAt) {
    // Déjà vérifié : on répond en succès. L'utilisateur qui reclique sur son
    // lien veut savoir que son adresse est confirmée, pas lire une erreur.
    if (token.user.emailVerified) {
      return ok({ alreadyVerified: true, message: "Votre adresse est déjà confirmée." });
    }

    throw new ApiError("BAD_REQUEST", "Ce lien a déjà été utilisé.");
  }

  if (token.expiresAt < new Date()) {
    throw new ApiError(
      "BAD_REQUEST",
      "Ce lien a expiré. Demandez-en un nouveau depuis votre compte."
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    }),
    prisma.verificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    // Les autres tokens de vérification en attente n'ont plus d'objet.
    // Les laisser valides multiplierait sans raison les liens actifs.
    prisma.verificationToken.deleteMany({
      where: {
        userId: token.userId,
        type: "EMAIL_VERIFICATION",
        id: { not: token.id },
      },
    }),
  ]);

  return ok({
    alreadyVerified: false,
    message: "Adresse confirmée. Votre compte est pleinement actif.",
  });
});
