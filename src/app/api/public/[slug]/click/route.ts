import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { recordClick } from "@/lib/biolinks/public";

const bodySchema = z.object({ linkId: z.string().uuid() });

/**
 * POST /api/public/:slug/click
 *
 * Enregistre un clic sur un lien. Appelé via `sendBeacon` : la requête part
 * au moment où le lien s'ouvre, on répond vite et sans effet de bord visible.
 */
export const POST = withErrorHandling(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    await enforce("publicPage", `click:${clientIp(request)}`);

    const raw = await request.text();
    const parsed = bodySchema.safeParse(raw ? JSON.parse(raw) : {});

    if (!parsed.success) return ok({ counted: false });

    const biolink = await prisma.biolink.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, isPublished: true },
    });

    if (!biolink || !biolink.isPublished) return ok({ counted: false });

    // Le lien doit appartenir à cette page : sans ce contrôle, on pourrait
    // gonfler le compteur de n'importe quel lien via n'importe quelle page.
    const link = await prisma.link.findUnique({
      where: { id: parsed.data.linkId },
      select: { id: true, biolinkId: true },
    });

    if (!link || link.biolinkId !== biolink.id) return ok({ counted: false });

    await recordClick(biolink.id, link.id);

    return ok({ counted: true });
  }
);
