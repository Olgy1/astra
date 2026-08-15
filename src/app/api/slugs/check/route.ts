import { z } from "zod";
import { clientIp, ok, parseQuery, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/context";
import {
  checkSlugAvailability,
  slugFormatSchema,
  suggestAlternatives,
} from "@/lib/schemas/slug";

const querySchema = z.object({ slug: z.string().max(64) });

/**
 * GET /api/slugs/check?slug=
 *
 * Disponibilité d'un lien, pour le champ de la landing et de l'éditeur.
 *
 * Public, mais rate-limité : l'endpoint permet de savoir quels pseudos sont
 * pris, ce qui est de toute façon lisible en visitant astraa.is-cool.dev/pseudo. Le
 * plafond existe pour empêcher d'en aspirer la liste complète.
 *
 * La réponse est indicative et ne réserve rien : entre ce contrôle et la
 * création, quelqu'un peut prendre le lien. C'est la contrainte unique en
 * base qui garantit l'exclusivité.
 */
export const GET = withErrorHandling(async (request: Request) => {
  await enforce("publicPage", `slugcheck:${clientIp(request)}`);

  const { slug } = parseQuery(request, querySchema);

  // Format uniquement : un slug réservé est bien formé, il doit ressortir en
  // RESERVED via `checkSlugAvailability`, pas en INVALID.
  const parsed = slugFormatSchema.safeParse(slug);

  if (!parsed.success) {
    return ok({
      slug,
      available: false,
      reason: "INVALID" as const,
      message: parsed.error.issues[0]?.message ?? "Lien invalide.",
      suggestions: [],
    });
  }

  const user = await getCurrentUser();
  const availability = await checkSlugAvailability(parsed.data, {
    isAdmin: user?.role === "ADMIN",
  });

  if (availability.available) {
    return ok({ slug: parsed.data, available: true, suggestions: [] });
  }

  return ok({
    slug: parsed.data,
    available: false,
    reason: availability.reason,
    message: availability.message,
    // Ne proposer des alternatives que si le lien est simplement pris.
    // En suggérer sur un mot réservé reviendrait à contourner la réservation.
    suggestions:
      availability.reason === "TAKEN" ? await suggestAlternatives(parsed.data) : [],
  });
});
