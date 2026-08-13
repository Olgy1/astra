import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/context";

const reportSchema = z.object({
  reason: z.enum(["spam", "harassment", "illegal", "impersonation", "other"]),
  details: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/public/:slug/report
 *
 * Signale une page. Ouvert à tous (le signalement peut être anonyme), mais
 * rate-limité strictement : sans plafond, l'endpoint deviendrait un outil de
 * harcèlement par signalements en masse.
 */
export const POST = withErrorHandling(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    await enforce("report", `report:${clientIp(request)}`);

    const input = await parseBody(request, reportSchema);

    const biolink = await prisma.biolink.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, isPublished: true },
    });

    if (!biolink || !biolink.isPublished) {
      throw new ApiError("NOT_FOUND", "Cette page est introuvable.");
    }

    // reporterId si connecté, null sinon : un signalement anonyme reste
    // recevable, mais on trace l'auteur quand on le connaît, pour repérer les
    // abus de signalement.
    const user = await getCurrentUser();

    await prisma.report.create({
      data: {
        biolinkId: biolink.id,
        reporterId: user?.id ?? null,
        reason: input.reason,
        details: input.details,
      },
    });

    return ok({
      message: "Merci. Votre signalement a été transmis à notre équipe de modération.",
    });
  }
);
