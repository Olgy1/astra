import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { invalidatePageCache } from "@/lib/redis";
import { sendUnsuspensionEmail } from "@/lib/mail";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/biolinks/:id/unsuspend
 * Lève une suspension de page avant son terme : la page redevient
 * immédiatement publique, l'auteur retrouve le contrôle de la publication,
 * et le propriétaire est prévenu par email. La ligne d'historique est
 * marquée `liftedAt` — l'historique n'est jamais effacé, la fiche
 * utilisateur affiche « Levée ».
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const biolink = await prisma.biolink.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      ownerId: true,
      suspendedUntil: true,
      owner: { select: { id: true, username: true, email: true } },
    },
  });

  if (!biolink) throw new ApiError("NOT_FOUND", "Cette page est introuvable.");

  const suspended = biolink.suspendedUntil !== null && biolink.suspendedUntil > new Date();
  if (!suspended) {
    throw new ApiError("CONFLICT", "Cette page n'est pas suspendue actuellement.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.biolink.update({
      where: { id: biolink.id },
      data: { suspendedUntil: null, suspensionReason: null },
    });

    // Marque comme levée la suspension en cours (la plus récente non levée).
    // Les entrées plus anciennes restent intactes dans l'historique.
    await tx.suspension.updateMany({
      where: { biolinkId: biolink.id, liftedAt: null },
      data: { liftedAt: new Date() },
    });
  });

  await invalidatePageCache(biolink.slug);

  // L'envoi ne fait pas échouer la levée : le mail part après coup, l'état
  // de la page est déjà cohérent.
  await sendUnsuspensionEmail(biolink.owner.id, biolink.owner.email, biolink.owner.username, biolink.slug);

  await writeAdminLog({
    admin,
    action: "biolink.unsuspend",
    targetType: "biolink",
    targetId: biolink.id,
    metadata: {
      slug: biolink.slug,
      ownerId: biolink.ownerId,
      ownerEmail: biolink.owner.email,
    },
    ip: clientIp(request),
  });

  return ok({
    message: `La suspension de astra.is-a.dev/${biolink.slug} a été levée. Le propriétaire a été prévenu par email.`,
  });
});
