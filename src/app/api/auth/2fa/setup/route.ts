import { ApiError, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireVerifiedUser } from "@/lib/auth/context";
import { generateTotpSetup } from "@/lib/auth/totp";

/**
 * POST /api/auth/2fa/setup
 *
 * Génère un secret TOTP et son QR code. Ne persiste rien : le secret est
 * renvoyé au client, qui le représentera à /2fa/enable avec un code valide.
 *
 * Pourquoi ne pas le stocker tout de suite : un secret écrit en base avant
 * confirmation laisse des comptes dans un état bâtard si l'utilisateur
 * abandonne — 2FA à moitié configurée, ni active ni absente. Ici, tant que
 * /enable n'a pas réussi, il ne s'est rien passé.
 *
 * Le revers : le secret transite deux fois. Il est protégé par HTTPS et le
 * cookie de session, et sa fenêtre de vie utile est la durée du formulaire.
 */
export const POST = withErrorHandling(async () => {
  const user = await requireVerifiedUser();

  if (user.twoFactorEnabled) {
    throw new ApiError(
      "CONFLICT",
      "La double authentification est déjà active. Désactivez-la avant d'en configurer une nouvelle."
    );
  }

  await enforce("login", `2fa-setup:${user.id}`);

  const setup = await generateTotpSetup(user.username);

  return ok({
    secret: setup.secret,
    qrCodeDataUrl: setup.qrCodeDataUrl,
    // Pour la saisie manuelle, quand l'appareil ne peut pas scanner.
    manualEntryKey: setup.secret.match(/.{1,4}/g)?.join(" ") ?? setup.secret,
    instructions:
      "Scannez ce QR code avec votre application d'authentification, puis saisissez le code à 6 chiffres qu'elle affiche pour confirmer.",
  });
});
