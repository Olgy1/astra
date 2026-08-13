import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { createOneTimeToken, TOKEN_TTL } from "@/lib/auth/tokens";
import { verifyCaptcha } from "@/lib/auth/captcha";
import { sendPasswordResetEmail } from "@/lib/mail";
import { forgotPasswordSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/password/forgot
 *
 * Envoie le lien de réinitialisation.
 *
 * Répond exactement la même chose que l'adresse existe ou non. C'est la seule
 * façon d'empêcher que cet endpoint serve d'oracle : « cette adresse a-t-elle
 * un compte chez vous ? » est une information qu'on ne donne pas — a fortiori
 * sur une plateforme où le pseudo est public mais l'email ne l'est pas.
 */
const GENERIC_RESPONSE = {
  message:
    "Si un compte est associé à cette adresse, un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.",
};

export const POST = withErrorHandling(async (request: Request) => {
  const ip = clientIp(request);
  await enforce("passwordReset", ip);

  const input = await parseBody(request, forgotPasswordSchema);

  const captcha = await verifyCaptcha(input.captchaToken, ip);
  if (!captcha.ok) {
    throw new ApiError("CAPTCHA_REQUIRED", "Validez le captcha pour continuer.");
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, username: true, email: true, status: true },
  });

  // Sortie silencieuse : même réponse, même code HTTP. Un compte banni ne
  // reçoit pas de lien non plus — inutile de lui rendre l'accès.
  if (!user || user.status === "BANNED") {
    return ok(GENERIC_RESPONSE);
  }

  const reset = createOneTimeToken(TOKEN_TTL.passwordReset);

  await prisma.$transaction([
    // Un seul lien de reset valide à la fois. En redemander un invalide le
    // précédent, ce qui limite la fenêtre où un lien traîne dans une boîte.
    prisma.verificationToken.deleteMany({
      where: { userId: user.id, type: "PASSWORD_RESET" },
    }),
    prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: reset.tokenHash,
        expiresAt: reset.expiresAt,
      },
    }),
  ]);

  await sendPasswordResetEmail(user.id, user.email, user.username, reset.token);

  return ok(GENERIC_RESPONSE);
});
