import { prisma } from "@/lib/db";
import { clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { getDiscordPresence } from "@/lib/discord/presence";

/**
 * GET /api/public/:slug/presence
 *
 * Présence Discord du propriétaire de la page.
 *
 * L'ID Discord vient de `User.discordId`, jamais du client : afficher la
 * présence à partir d'un ID fourni permettrait d'afficher celle de n'importe
 * qui sous le nom d'un autre.
 *
 * L'implémentation réelle (Lanyard ou gateway) arrive à l'étape 7 ;
 * `getDiscordPresence` renvoie déjà une forme stable, y compris quand la
 * source est indisponible.
 */
export const GET = withErrorHandling(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    await enforce("publicPage", `presence:${clientIp(request)}`);

    const biolink = await prisma.biolink.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { isPublished: true, owner: { select: { discordId: true } } },
    });

    if (!biolink || !biolink.isPublished || !biolink.owner.discordId) {
      return ok(null);
    }

    const presence = await getDiscordPresence(biolink.owner.discordId);
    return ok(presence);
  }
);
