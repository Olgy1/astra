import { isCaptchaConfigured, serverEnv } from "@/lib/env";
import { getLoginFailures } from "@/lib/rate-limit";

/**
 * Vérification de captcha (Cloudflare Turnstile ou hCaptcha).
 *
 * Le captcha n'est pas exigé d'emblée : il n'apparaît qu'après N échecs sur
 * un même identifiant. Le rate limiting freine déjà le débit ; le captcha est
 * la seconde barrière, celle qui coûte cher à automatiser. L'imposer à tout
 * le monde dès le premier essai punirait les 99 % d'utilisateurs légitimes
 * pour le 1 % restant.
 */

const TURNSTILE_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type CaptchaResult =
  | { ok: true }
  | { ok: false; reason: "MISSING" | "INVALID" | "PROVIDER_ERROR" };

/**
 * Le captcha est-il exigé pour cet identifiant ?
 * Faux si le captcha n'est pas configuré (développement).
 */
export async function isCaptchaRequired(identifier: string): Promise<boolean> {
  if (!isCaptchaConfigured()) return false;

  const failures = await getLoginFailures(identifier);
  return failures >= serverEnv().LOGIN_ATTEMPTS_BEFORE_CAPTCHA;
}

/**
 * Vérifie un jeton de captcha auprès du fournisseur.
 *
 * En cas d'erreur du fournisseur (réseau, panne), on refuse : fail-closed.
 * C'est l'inverse du choix fait pour le rate limiting, et c'est délibéré. Le
 * captcha n'est demandé qu'après plusieurs échecs, donc à quelqu'un qui a
 * déjà l'air d'attaquer. Laisser passer sur panne offrirait à l'attaquant un
 * moyen de contourner la barrière en saturant le fournisseur.
 */
export async function verifyCaptcha(
  token: string | undefined,
  ipAddress?: string
): Promise<CaptchaResult> {
  if (!isCaptchaConfigured()) return { ok: true };

  if (!token) return { ok: false, reason: "MISSING" };

  try {
    const body = new URLSearchParams({
      secret: serverEnv().CAPTCHA_SECRET_KEY!,
      response: token,
    });

    if (ipAddress && ipAddress !== "0.0.0.0") {
      body.set("remoteip", ipAddress);
    }

    const response = await fetch(TURNSTILE_ENDPOINT, {
      method: "POST",
      body,
      // Sans timeout, une panne du fournisseur ferait pendre la requête de
      // login jusqu'au timeout par défaut de fetch.
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error("[captcha] réponse HTTP", response.status);
      return { ok: false, reason: "PROVIDER_ERROR" };
    }

    const result = (await response.json()) as { success?: boolean };

    return result.success === true ? { ok: true } : { ok: false, reason: "INVALID" };
  } catch (error) {
    console.error("[captcha] vérification impossible :", error);
    return { ok: false, reason: "PROVIDER_ERROR" };
  }
}
