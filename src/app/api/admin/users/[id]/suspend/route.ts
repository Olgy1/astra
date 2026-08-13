import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { revokeAllSessions } from "@/lib/auth/session";
import { sendAccountSuspendedEmail } from "@/lib/mail";

type Context = { params: Promise<{ id: string }> };

const suspendSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  // Durée en jours. Absente = suspension indéterminée (jusqu'à décision).
  days: z.coerce.number().int().min(1).max(365).optional(),
});

/**
 * POST /api/admin/users/:id/suspend
 * Suspension temporaire : sessions révoquées, connexion bloquée jusqu'à la
 * date, puis retour à la normale automatique (relevé à la volée par
 * `getCurrentUser`). Contrairement au ban, les pages restent publiées.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, suspendSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true, status: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");
  if (target.id === admin.id) {
    throw new ApiError("BAD_REQUEST", "Vous ne pouvez pas suspendre votre propre compte.");
  }

  const suspendedUntil = input.days
    ? new Date(Date.now() + input.days * 24 * 3600 * 1000)
    : null;

  await prisma.user.update({
    where: { id: target.id },
    data: {
      status: "SUSPENDED",
      statusReason: input.reason ?? null,
      suspendedUntil,
    },
  });

  const revoked = await revokeAllSessions(target.id);

  // Préviens l'utilisateur : c'est lui qui doit connaître le motif et la
  // durée. L'envoi ne fait pas échouer la suspension — s'il échoue, la
  // sanction reste appliquée et l'échec est visible dans l'historique des
  // emails.
  await sendAccountSuspendedEmail(
    target.id,
    target.email,
    target.username,
    input.reason ?? null,
    suspendedUntil
  );

  await writeAdminLog({
    admin,
    action: "user.suspend",
    targetType: "user",
    targetId: target.id,
    metadata: {
      username: target.username,
      reason: input.reason ?? null,
      days: input.days ?? null,
      until: suspendedUntil?.toISOString() ?? null,
      revokedSessions: revoked,
    },
    ip: clientIp(request),
  });

  return ok({
    message: `${target.username} est suspendu${suspendedUntil ? ` jusqu'au ${suspendedUntil.toLocaleDateString("fr-FR")}` : " pour une durée indéterminée"}.`,
    suspendedUntil,
    revokedSessions: revoked,
  });
});
