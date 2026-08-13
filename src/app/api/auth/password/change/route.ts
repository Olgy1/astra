import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { sendPasswordChangedEmail } from "@/lib/mail";
import { changePasswordSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/password/change
 *
 * Change le mot de passe depuis le compte. Exige l'ancien : sans ça, un
 * navigateur laissé ouvert suffirait à verrouiller définitivement le
 * propriétaire hors de son propre compte.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  await enforce("login", `change:${user.id}`);

  const input = await parseBody(request, changePasswordSchema);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!record?.passwordHash) {
    throw new ApiError(
      "CONFLICT",
      "Ce compte n'a pas de mot de passe : il utilise la connexion Discord. Utilisez « mot de passe oublié » pour en définir un."
    );
  }

  const valid = await verifyPassword(record.passwordHash, input.currentPassword);

  if (!valid) {
    throw new ApiError("UNAUTHENTICATED", "Mot de passe actuel incorrect.", {
      currentPassword: ["Mot de passe actuel incorrect."],
    });
  }

  if (input.currentPassword === input.newPassword) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Le nouveau mot de passe doit être différent de l'ancien.",
      { newPassword: ["Le nouveau mot de passe doit être différent de l'ancien."] }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });

  // On garde la session courante : déconnecter quelqu'un de l'écran où il
  // vient de changer son mot de passe serait absurde. Les autres tombent.
  const revoked = await revokeAllSessions(user.id, user.sessionId);

  await sendPasswordChangedEmail(user.id, user.email, user.username);

  return ok({
    revokedSessions: revoked,
    message:
      revoked > 0
        ? `Mot de passe modifié. ${revoked} autre(s) appareil(s) ont été déconnectés.`
        : "Mot de passe modifié.",
  });
});
