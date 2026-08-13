import { ok, withErrorHandling } from "@/lib/api";
import { requireUser } from "@/lib/auth/context";
import { publicBlockCatalog } from "@/lib/blocks/registry";

/**
 * GET /api/blocks/catalog
 *
 * Types de blocks disponibles, filtrés par rôle. Alimente le sélecteur de
 * l'éditeur.
 *
 * Les schémas zod ne sont pas exposés : ils ne sont pas sérialisables et
 * n'ont rien à faire dans le bundle client. L'éditeur reçoit les libellés et
 * les contraintes ; la validation qui fait foi reste serveur.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const catalog = publicBlockCatalog(user.role === "ADMIN");

  return ok({
    catalog,
    categories: [
      { key: "identity", label: "Identité" },
      { key: "links", label: "Liens" },
      { key: "embeds", label: "Intégrations" },
      { key: "widgets", label: "Widgets" },
    ],
  });
});
