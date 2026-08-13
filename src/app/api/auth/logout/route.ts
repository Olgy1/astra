import { ok, withErrorHandling } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 *
 * Ferme la session courante. N'exige pas d'authentification valide : si le
 * token est déjà expiré ou corrompu, on veut quand même effacer les cookies
 * plutôt que renvoyer une erreur à quelqu'un qui demande simplement à partir.
 */
export const POST = withErrorHandling(async () => {
  await destroySession();
  return ok({ message: "Déconnecté." });
});
