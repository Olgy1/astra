import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { createOneTimeToken, TOKEN_TTL } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/users/:id/reset-password
 * Force un reset par email : invalide les liens précédents et envoie un lien
 * frais. L'admin ne voit jamais le mot de passe — il ne le définit pas, il
 * donne à l'utilisateur le moyen d'en choisir un.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true, status: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");
  if (target.id === admin.id) {
    throw new ApiError("BAD_REQUEST", "Utilisez les paramètres de votre compte pour changer votre propre mot de passe.");
  }
  if (target.status === "BANNED") {
    throw new ApiError("BAD_REQUEST", "Un compte banni ne reçoit pas de lien de réinitialisation.");
  }

  const reset = createOneTimeToken(TOKEN_TTL.passwordReset);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: { userId: target.id, type: "PASSWORD_RESET" },
    }),
    prisma.verificationToken.create({
      data: {
        userId: target.id,
        type: "PASSWORD_RESET",
        tokenHash: reset.tokenHash,
        expiresAt: reset.expiresAt,
      },
    }),
  ]);

  await sendPasswordResetEmail(target.id, target.email, target.username, reset.token);

  await writeAdminLog({
    admin,
    action: "user.reset_password",
    targetType: "user",
    targetId: target.id,
    metadata: { username: target.username, email: target.email },
    ip: clientIp(request),
  });

  return ok({
    message: `Un lien de réinitialisation a été envoyé à ${target.email}.`,
  });
});
