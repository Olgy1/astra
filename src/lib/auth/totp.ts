import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * Double authentification par TOTP (RFC 6238).
 *
 * Compatible avec Google Authenticator, Authy, 1Password, Bitwarden — le
 * standard est le même partout.
 */

const ISSUER = "Astra";
const DIGITS = 6;
const PERIOD = 30;

/**
 * Tolérance de dérive d'horloge, en périodes de 30 s.
 *
 * 1 = on accepte le code précédent, le courant et le suivant, soit une
 * fenêtre de 90 secondes. C'est le compromis usuel : une horloge de téléphone
 * dérive de quelques secondes, et refuser un code juste parce que
 * l'utilisateur a mis 31 secondes à le recopier rendrait la 2FA détestable.
 * Élargir davantage augmenterait linéairement la surface de devinette.
 */
const WINDOW = 1;

function buildTotp(secretBase32: string, accountLabel: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1", // imposé par la compatibilité des apps d'authentification
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export type TotpSetup = {
  /** Secret en base32, à chiffrer avant stockage. */
  secret: string;
  /** URI otpauth:// à encoder en QR code. */
  uri: string;
  /** QR code en data URI, affichable directement dans un <img>. */
  qrCodeDataUrl: string;
};

/** Génère un secret TOTP et son QR code. Le secret n'est pas encore persisté. */
export async function generateTotpSetup(username: string): Promise<TotpSetup> {
  const secret = new OTPAuth.Secret({ size: 20 }); // 160 bits, recommandé par la RFC
  const totp = buildTotp(secret.base32, username);
  const uri = totp.toString();

  return {
    secret: secret.base32,
    uri,
    qrCodeDataUrl: await QRCode.toDataURL(uri, {
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }),
  };
}

/**
 * Vérifie un code à 6 chiffres contre un secret en clair.
 * Retourne false plutôt que de lancer : un code faux est un cas nominal.
 */
export function verifyTotpCode(secretBase32: string, code: string, username: string): boolean {
  const normalized = code.replace(/\s/g, "");

  if (!/^\d{6}$/.test(normalized)) return false;

  try {
    const delta = buildTotp(secretBase32, username).validate({
      token: normalized,
      window: WINDOW,
    });
    // validate() renvoie l'écart en périodes, ou null si aucun code de la
    // fenêtre ne correspond.
    return delta !== null;
  } catch {
    return false;
  }
}

/** Vérifie un code contre un secret chiffré tel que stocké en base. */
export function verifyEncryptedTotpCode(
  encryptedSecret: string,
  code: string,
  username: string
): boolean {
  try {
    return verifyTotpCode(decrypt(encryptedSecret), code, username);
  } catch (error) {
    // Déchiffrement impossible : ENCRYPTION_KEY a changé. Le compte est
    // verrouillé hors d'atteinte de son propriétaire, il faut le savoir.
    console.error("[totp] déchiffrement du secret impossible :", error);
    return false;
  }
}

export function encryptTotpSecret(secretBase32: string): string {
  return encrypt(secretBase32);
}

// ---------------------------------------------------------------------------
// Codes de secours
// ---------------------------------------------------------------------------

const BACKUP_CODE_COUNT = 10;

/**
 * Génère des codes de secours à usage unique.
 *
 * Sans eux, perdre son téléphone = perdre son compte, et le support n'a
 * d'autre choix que de désactiver la 2FA sur simple demande — ce qui la vide
 * de son sens.
 *
 * Format : 8 caractères hexadécimaux affichés en deux groupes de 4.
 */
export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const raw = randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}

/**
 * Hash d'un code de secours pour le stockage.
 *
 * SHA-256 : le code fait 32 bits d'entropie, ce qui est peu, mais il est à
 * usage unique et le login est rate-limité. Argon2 coûterait 50 ms par
 * tentative de vérification, pour dix codes à tester en séquence.
 */
export function hashBackupCode(code: string): string {
  return createHash("sha256")
    .update(code.replace(/[\s-]/g, "").toUpperCase())
    .digest("hex");
}

/**
 * Cherche un code de secours parmi les hashs stockés.
 * Retourne son index, ou -1. Comparaison à temps constant.
 */
export function findBackupCode(hashes: string[], candidate: string): number {
  const target = Buffer.from(hashBackupCode(candidate), "utf8");

  for (let i = 0; i < hashes.length; i++) {
    const stored = Buffer.from(hashes[i], "utf8");
    if (stored.length === target.length && timingSafeEqual(stored, target)) {
      return i;
    }
  }

  return -1;
}
