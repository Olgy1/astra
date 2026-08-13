import { cookies } from "next/headers";
import { clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { getPublicPage } from "@/lib/biolinks/public";
import { unlockCookieName, verifyUnlockToken } from "@/lib/biolinks/unlock";
import { fail } from "@/lib/api";

/**
 * GET /api/public/:slug
 *
 * Données de rendu d'une page publique, en JSON.
 *
 * La page elle-même est rendue côté serveur (app/[slug]/page.tsx) ; cet
 * endpoint sert aux clients qui veulent les données brutes — l'aperçu live de
 * l'éditeur (étape 5), ou un futur client mobile.
 */
export const GET = withErrorHandling(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    await enforce("publicPage", `page:${clientIp(request)}`);

    const page = await getPublicPage(slug);

    if (!page) {
      return fail("NOT_FOUND", "Cette page est introuvable.");
    }

    // Une page protégée ne livre son contenu que sur présentation d'un jeton
    // de déverrouillage valide — la même règle que le rendu serveur.
    if (page.isPasswordProtected) {
      const store = await cookies();
      const token = store.get(unlockCookieName(page.id))?.value;

      if (!verifyUnlockToken(page.id, token)) {
        return ok({
          slug: page.slug,
          locked: true as const,
          // On ne renvoie que le strict minimum pour afficher l'écran de
          // saisie : titre et thème, jamais les liens ni les blocks.
          title: page.seoTitle ?? page.title,
        });
      }
    }

    return ok({ ...page, locked: false as const });
  }
);
