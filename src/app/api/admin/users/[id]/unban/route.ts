import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { sendAccountUnsuspendedEmail } from "@/lib/mail";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/users/:id/unban
 * Lève la sanction (ban ou suspension) : statut ACTIVE, motifs effacés.
 * Les pages restent dans l'état où la sanction les a laissées — l'admin les
 * republie explicitement s'il le souhaite.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true, status: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  if (target.status === "ACTIVE") {
    throw new ApiError("BAD_REQUEST", `${target.username} n'a aucune sanction active.`);
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { status: "ACTIVE", statusReason: null, suspendedUntil: null },
  });

  // Confirme par email que le compte est de nouveau accessible. L'échec
  // d'envoi n'annule pas la levée : la sanction est déjà levée, l'erreur
  // reste visible dans l'historique des emails.
  await sendAccountUnsuspendedEmail(target.id, target.email, target.username);

  await writeAdminLog({
    admin,
    action: "user.unban",
    targetType: "user",
    targetId: target.id,
    metadata: { username: target.username, from: target.status },
    ip: clientIp(request),
  });

  return ok({ message: `La sanction de ${target.username} a été levée.` });
});
