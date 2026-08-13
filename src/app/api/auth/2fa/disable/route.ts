import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { verifyPassword } from "@/lib/auth/password";
import { sendTwoFactorChangedEmail } from "@/lib/mail";
import { disableTwoFactorSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/2fa/disable
 *
 * Exige le mot de passe. Retirer une protection doit coûter au moins aussi
 * cher que la poser : sinon une session volée suffirait à désarmer le second
 * facteur, ce qui le viderait de son sens.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  await enforce("login", `2fa-disable:${user.id}`);

  if (!user.twoFactorEnabled) {
    throw new ApiError("CONFLICT", "La double authentification n'est pas active.");
  }

  const input = await parseBody(request, disableTwoFactorSchema);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!record?.passwordHash) {
    throw new ApiError(
      "CONFLICT",
      "Ce compte n'a pas de mot de passe. Définissez-en un avant de désactiver la double authentification."
    );
  }

  if (!(await verifyPassword(record.passwordHash, input.password))) {
    throw new ApiError("UNAUTHENTICATED", "Mot de passe incorrect.", {
      password: ["Mot de passe incorrect."],
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });

  await sendTwoFactorChangedEmail(user.id, user.email, user.username, false);

  return ok({ message: "Double authentification désactivée." });
});
