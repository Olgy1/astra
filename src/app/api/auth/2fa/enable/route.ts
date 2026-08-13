import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireVerifiedUser } from "@/lib/auth/context";
import {
  encryptTotpSecret,
  generateBackupCodes,
  hashBackupCode,
  verifyTotpCode,
} from "@/lib/auth/totp";
import { sendTwoFactorChangedEmail } from "@/lib/mail";
import { enableTwoFactorSchema } from "@/lib/schemas/auth";

/**
 * POST /api/auth/2fa/enable
 *
 * Active la 2FA après vérification d'un code. Renvoie les codes de secours,
 * une seule fois : ils ne sont stockés que hachés, on ne pourra plus les
 * réafficher.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireVerifiedUser();
  await enforce("login", `2fa-enable:${user.id}`);

  if (user.twoFactorEnabled) {
    throw new ApiError("CONFLICT", "La double authentification est déjà active.");
  }

  const input = await parseBody(request, enableTwoFactorSchema);

  // Le code prouve que l'application a bien enregistré le secret. Sans cette
  // vérification, un QR mal scanné activerait une 2FA dont personne ne peut
  // produire les codes — compte perdu.
  if (!verifyTotpCode(input.secret, input.code, user.username)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Code incorrect. Vérifiez que l'heure de votre téléphone est bien synchronisée.",
      { code: ["Code incorrect."] }
    );
  }

  const backupCodes = generateBackupCodes();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptTotpSecret(input.secret),
      twoFactorBackupCodes: backupCodes.map(hashBackupCode),
    },
  });

  await sendTwoFactorChangedEmail(user.id, user.email, user.username, true);

  return ok({
    backupCodes,
    message:
      "Double authentification activée. Conservez ces codes de secours en lieu sûr : ils ne seront plus jamais affichés, et ils sont votre seul recours si vous perdez votre téléphone.",
  });
});
