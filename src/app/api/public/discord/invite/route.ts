import { z } from "zod";
import { clientIp, ok, parseQuery, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";

const querySchema = z.object({
  code: z.string().regex(/^[a-zA-Z0-9-]{2,32}$/, "Code d'invitation invalide."),
});

type InvitePayload = {
  guild?: { id?: string; name?: string; icon?: string | null };
  approximate_member_count?: number;
  approximate_presence_count?: number;
};

/**
 * GET /api/public/discord/invite?code=abc123
 *
 * Récupère les informations publiques d'un serveur Discord depuis son code
 * d'invitation : nom, icône, nombre de membres et de membres en ligne.
 *
 * L'appel à l'API Discord se fait côté serveur : l'API d'invitation n'autorise
 * pas les requêtes depuis un navigateur (CORS), et on met le résultat en
 * cache (1 h) pour ne pas re-frapper Discord à chaque vue de page.
 *
 * Aucune donnée privée n'est exposée : ce sont les compteurs approximatifs
 * publics que Discord lui-même affiche sur la page d'invitation.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { code } = parseQuery(request, querySchema);
  await enforce("discordInvite", `invite:${clientIp(request)}`);

  const response = await fetch(
    `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`,
    {
      headers: {
        "User-Agent": "Astra (https://astra.is-a.dev, contact@astra.is-a.dev)",
      },
      // Cache serveur : une invitation n'est relue au plus qu'une fois par
      // heure, même si des dizaines de visiteurs chargent la page.
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    // Invitation inconnue, expirée ou serveur injoignable : le block affiche
    // son état de repli (logo + code). Pas d'erreur fatale.
    return ok({ valid: false });
  }

  const payload = (await response.json()) as InvitePayload;
  const guild = payload.guild;

  if (!guild?.id) {
    return ok({ valid: false });
  }

  const icon =
    typeof guild.icon === "string" && guild.icon.length > 0
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
      : null;

  return ok({
    valid: true,
    name: typeof guild.name === "string" ? guild.name : null,
    icon,
    memberCount:
      typeof payload.approximate_member_count === "number"
        ? payload.approximate_member_count
        : null,
    onlineCount:
      typeof payload.approximate_presence_count === "number"
        ? payload.approximate_presence_count
        : null,
  });
});
