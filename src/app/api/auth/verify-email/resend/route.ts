import { prisma } from "@/lib/db";
import { ApiError, ok, withErrorHandling } from "@/lib/api";
import { isMailConfigured, serverEnv } from "@/lib/env";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { createOneTimeToken, TOKEN_TTL } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/mail";

/**
 * POST /api/auth/verify-email/resend
 *
 * Renvoie l'email de vérification. Rate-limité par compte et non par IP :
 * l'objectif est d'empêcher d'utiliser notre serveur pour inonder la boîte
 * mail de quelqu'un, ce qu'un plafond par IP ne ferait pas si l'attaquant
 * change d'IP.
 */
export const POST = withErrorHandling(async () => {
  const user = await requireUser();

  if (user.emailVerified) {
    throw new ApiError("CONFLICT", "Votre adresse est déjà confirmée.");
  }

  await enforce("emailResend", `user:${user.id}`);

  const verification = createOneTimeToken(TOKEN_TTL.emailVerification);

  await prisma.$transaction([
    // Les anciens liens sont invalidés : deux liens valides en circulation
    // doublent la fenêtre d'exposition pour rien.
    prisma.verificationToken.deleteMany({
      where: { userId: user.id, type: "EMAIL_VERIFICATION" },
    }),
    prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: "EMAIL_VERIFICATION",
        tokenHash: verification.tokenHash,
        expiresAt: verification.expiresAt,
      },
    }),
  ]);

  await sendVerificationEmail(user.id, user.email, user.username, verification.token);

  return ok({
    message: isMailConfigured()
      ? `Un nouveau lien a été envoyé à ${user.email}. Il expire dans 24 heures.`
      : `Aucun serveur SMTP n'est configuré : le lien n'a pas été envoyé par email.`,
    /**
     * Lien renvoyé en clair — uniquement en développement, et uniquement
     * quand aucun SMTP n'est configuré.
     *
     * Ce n'est pas une commodité anodine : afficher le lien dans l'interface
     * vide la vérification d'email de son sens. Tout son objet est de prouver
     * que la personne contrôle la boîte ; le lui donner sans passer par la
     * boîte ne prouve plus rien.
     *
     * D'où la double condition, et le fait qu'elle porte sur `serverEnv()`
     * (validé au démarrage) et non sur `process.env` brut.
     */
    devLink:
      serverEnv().NODE_ENV === "development" && !isMailConfigured()
        ? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify-email?token=${verification.token}`
        : undefined,
  });
});
