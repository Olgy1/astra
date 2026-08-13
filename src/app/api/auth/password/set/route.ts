import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { setPasswordSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/password/set
 *
 * Définit un mot de passe sur un compte qui n'en a pas (créé via Discord,
 * `passwordHash` null). Refusé si le compte a déjà un mot de passe : pour
 * le changer, il y a « mot de passe oublié » et les paramètres du compte.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  await enforce("login", `set-password:${user.id}`);

  const input = await parseBody(request, setPasswordSchema);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (record?.passwordHash) {
    throw new ApiError(
      "CONFLICT",
      "Ce compte a déjà un mot de passe. Utilisez « mot de passe oublié » ou vos paramètres pour le changer."
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password) },
  });

  // La session courante est gardée (on vient de l'utiliser) ; les autres
  // appareils tombent, comme pour un changement de mot de passe.
  await revokeAllSessions(user.id, user.sessionId);

  return ok({
    message:
      "Mot de passe défini. Vous pouvez maintenant vous connecter avec votre email et votre mot de passe.",
  });
});
