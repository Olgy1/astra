import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { invalidatePageCache } from "@/lib/redis";
import { sendSuspensionEmail } from "@/lib/mail";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]),
    note: z.string().trim().max(1000).optional(),
    // Optionnel : sanction appliquée au biolink en même temps que le
    // traitement (dépublication).
    unpublish: z.boolean().optional(),
    // Suspension temporaire de la page : durée en jours + motif. Résout le
    // signalement, suspend la page (écran « page suspendue »), envoie un
    // email au propriétaire. Le propriétaire garde l'édition mais ne peut ni
    // dépublier ni republier tant que la suspension est active.
    suspend: z
      .object({
        days: z.number().int().min(1).max(365),
        reason: z.string().trim().min(1, "Le motif est requis.").max(500),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Aucune modification fournie.");

/**
 * PATCH /api/admin/reports/:id
 * Traite un signalement : passe de PENDING à REVIEWING/RESOLVED/DISMISSED,
 * note de résolution, dépublication et/ou suspension temporaire de la page.
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, patchSchema);

  const report = await prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      biolinkId: true,
      status: true,
      biolink: {
        select: {
          slug: true,
          suspendedUntil: true,
          owner: { select: { id: true, username: true, email: true } },
        },
      },
    },
  });

  if (!report) throw new ApiError("NOT_FOUND", "Ce signalement est introuvable.");

  const suspendedUntil = input.suspend
    ? new Date(Date.now() + input.suspend.days * 24 * 3600 * 1000)
    : null;

  // Traitement transactionnel : le signalement, ses sanctions et la
  // suspension doivent être cohérents. Si l'un échoue, rien ne change.
  await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: {
        status: input.status,
        resolutionNote: input.note,
        resolvedBy: admin.id,
        resolvedAt: new Date(),
      },
    });

    const biolinkData: Record<string, boolean | Date | string> = {};
    if (input.unpublish) biolinkData.isPublished = false;
    if (input.suspend) {
      biolinkData.suspendedUntil = suspendedUntil!;
      biolinkData.suspensionReason = input.suspend.reason;
    }

    if (Object.keys(biolinkData).length > 0) {
      await tx.biolink.update({
        where: { id: report.biolinkId },
        data: biolinkData,
      });
    }

    // Trace une ligne d'historique (immuable) pour chaque suspension :
    // la fiche utilisateur du panel admin affiche qui, quand, combien de
    // temps et pourquoi. Une resuspension ajoute une nouvelle entrée.
    if (input.suspend) {
      await tx.suspension.create({
        data: {
          biolinkId: report.biolinkId,
          adminId: admin.id,
          reason: input.suspend.reason,
          startedAt: new Date(),
          until: suspendedUntil,
        },
      });
    }
  });

  // La page a peut-être été dépubliée ou suspendue : le cache public doit
  // suivre, sinon l'écran « page suspendue » (ou la dépublication) arriverait
  // avec jusqu'à une minute de retard.
  if (input.unpublish || input.suspend) {
    await invalidatePageCache(report.biolink.slug);
  }

  // La suspension prévient le propriétaire par email : c'est lui qui doit
  // corriger le motif. L'envoi ne fait pas échouer le traitement.
  if (input.suspend) {
    await sendSuspensionEmail(
      report.biolink.owner.id,
      report.biolink.owner.email,
      report.biolink.owner.username,
      report.biolink.slug,
      input.suspend.reason,
      suspendedUntil
    );
  }

  await writeAdminLog({
    admin,
    action: "report.resolve",
    targetType: "report",
    targetId: report.id,
    metadata: {
      biolinkSlug: report.biolink.slug,
      status: input.status,
      note: input.note ?? null,
      unpublish: input.unpublish ?? false,
      suspend: input.suspend
        ? {
            days: input.suspend.days,
            reason: input.suspend.reason,
            until: suspendedUntil?.toISOString(),
            ownerId: report.biolink.owner.id,
            ownerEmail: report.biolink.owner.email,
          }
        : null,
    },
    ip: clientIp(request),
  });

  return ok({
    message:
      input.suspend
        ? `Page suspendue ${suspendedUntil ? `jusqu'au ${suspendedUntil.toLocaleDateString("fr-FR")}` : ""} et signalement résolu. Le propriétaire a été prévenu par email.`
        : `Signalement ${input.status === "DISMISSED" ? "écarté" : input.status === "RESOLVED" ? "résolu" : "mis en revue"}.`,
  });
});

/**
 * DELETE /api/admin/reports/:id
 * Supprime le signalement (signalement abusif, doublon, ou nettoyage). La
 * page, elle, n'est pas touchée.
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;

  const report = await prisma.report.findUnique({
    where: { id },
    select: { id: true, biolink: { select: { slug: true } } },
  });

  if (!report) throw new ApiError("NOT_FOUND", "Ce signalement est introuvable.");

  await prisma.report.delete({ where: { id } });

  await writeAdminLog({
    admin,
    action: "report.delete",
    targetType: "report",
    targetId: report.id,
    metadata: { biolinkSlug: report.biolink.slug },
    ip: clientIp(request),
  });

  return ok({ message: "Signalement supprimé." });
});
