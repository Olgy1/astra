import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { createOneTimeToken, TOKEN_TTL } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";
import { verifyCaptcha } from "@/lib/auth/captcha";
import { sendVerificationEmail } from "@/lib/mail";
import { registerSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/register
 *
 * Crée le compte, envoie l'email de vérification, ouvre une session.
 *
 * On connecte immédiatement, avant vérification de l'email. Le compte existe
 * mais ne peut rien publier tant que l'adresse n'est pas confirmée (voir
 * `requireVerifiedUser`). Le faire attendre sur un écran « consultez vos
 * emails » avant même d'avoir vu le produit est le meilleur moyen de le
 * perdre.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const ip = clientIp(request);
  await enforce("register", ip);

  const input = await parseBody(request, registerSchema);

  const captcha = await verifyCaptcha(input.captchaToken, ip);
  if (!captcha.ok) {
    throw new ApiError(
      "CAPTCHA_REQUIRED",
      captcha.reason === "MISSING"
        ? "Validez le captcha pour continuer."
        : "Validation du captcha échouée. Réessayez."
    );
  }

  const passwordHash = await hashPassword(input.password);
  const verification = createOneTimeToken(TOKEN_TTL.emailVerification);

  let user;

  try {
    // Compte et token dans la même transaction : un compte sans token de
    // vérification serait un compte que personne ne peut activer.
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          // Dérivé, jamais saisi : la connexion et l'unicité s'appuient
          // dessus pour être insensibles à la casse.
          usernameLower: input.username.toLowerCase(),
          email: input.email,
          passwordHash,
          role: "MEMBER",
        },
        select: { id: true, username: true, email: true, role: true },
      });

      await tx.verificationToken.create({
        data: {
          userId: created.id,
          type: "EMAIL_VERIFICATION",
          tokenHash: verification.tokenHash,
          expiresAt: verification.expiresAt,
        },
      });

      return created;
    });
  } catch (error) {
    // P2002 = violation de contrainte unique. On s'appuie sur la base plutôt
    // que sur un findFirst préalable : entre le contrôle et l'insertion, deux
    // inscriptions simultanées passeraient toutes les deux.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | undefined) ?? [];

      // `username_lower` autant que `username` : c'est l'index insensible à
      // la casse qui saute en premier quand quelqu'un tente « Olgy » alors
      // qu'« olgy » existe.
      if (target.some((column) => column.includes("username"))) {
        throw new ApiError("CONFLICT", "Ce pseudo est déjà pris.", {
          username: ["Ce pseudo est déjà pris."],
        });
      }

      // Un message « cet email existe déjà » permet d'énumérer les comptes.
      // On répond volontairement à côté : l'utilisateur légitime qui a déjà
      // un compte recevra un email le lui rappelant (à câbler à l'étape 7),
      // l'attaquant n'apprend rien.
      throw new ApiError(
        "CONFLICT",
        "Impossible de créer le compte avec ces informations. Si vous avez déjà un compte, essayez de vous connecter.",
        { email: ["Vérifiez cette adresse, ou connectez-vous."] }
      );
    }

    throw error;
  }

  await sendVerificationEmail(user.id, user.email, user.username, verification.token);

  await createSession(user, {
    userAgent: request.headers.get("user-agent"),
    ipAddress: ip,
  });

  return ok(
    {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        emailVerified: false,
      },
      message: "Compte créé. Confirmez votre adresse email pour publier votre page.",
    },
    201
  );
});
