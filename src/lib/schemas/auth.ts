import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password-policy";
import { usernameSchema } from "@/lib/schemas/slug";

/**
 * Schémas des requêtes d'authentification.
 *
 * Ils font autorité côté serveur. Le front peut les réutiliser pour valider
 * avant envoi, mais cette validation-là n'est qu'un confort d'affichage.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse email invalide.")
  // La borne haute vient de la RFC 5321. Sans elle, on accepterait une chaîne
  // arbitrairement longue à hacher et à indexer.
  .max(254, "Adresse email trop longue.");

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  captchaToken: z.string().optional(),
  // Consentement explicite, horodaté par le serveur à l'inscription.
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Le login accepte un pseudo ou un email dans le même champ.
 * On ne valide pas le format ici : appliquer `emailSchema` révélerait par le
 * message d'erreur si l'identifiant saisi ressemble à un email, et une
 * validation stricte n'apporte rien puisque la valeur sert à un lookup exact.
 */
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Renseignez votre pseudo ou votre email.").max(254),
  password: z.string().min(1, "Renseignez votre mot de passe.").max(128),
  captchaToken: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Le code doit contenir 6 chiffres.");

/** Second facteur : soit un code TOTP, soit un code de secours. */
export const twoFactorLoginSchema = z.object({
  // Jeton de défi émis par /login, prouvant que le mot de passe a déjà été
  // validé. Sans lui, cet endpoint permettrait de tester des codes TOTP sans
  // connaître le mot de passe.
  challengeToken: z.string().min(1),
  code: z.string().trim().min(1, "Renseignez votre code."),
});

export type TwoFactorLoginInput = z.infer<typeof twoFactorLoginSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Lien de vérification invalide."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Lien de réinitialisation invalide."),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Renseignez votre mot de passe actuel."),
  newPassword: passwordSchema,
});

/**
 * Définition d'un premier mot de passe (compte créé via Discord, sans mot
 * de passe). Même politique que partout : `passwordSchema` fait foi.
 */
export const setPasswordSchema = z.object({
  password: passwordSchema,
});

export const enableTwoFactorSchema = z.object({
  // Le secret est renvoyé par /2fa/setup et non stocké entre les deux appels :
  // un secret persisté avant confirmation laisserait des comptes avec une 2FA
  // à moitié activée si l'utilisateur abandonne en cours de route.
  secret: z.string().min(16).max(64),
  code: totpCodeSchema,
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, "Renseignez votre mot de passe."),
});

/**
 * Message générique du login.
 *
 * Le même texte, que l'identifiant soit inconnu ou le mot de passe faux.
 * Distinguer les deux permettrait d'énumérer les comptes existants — c'est
 * précisément ce que le hash factice évite côté temps de réponse, autant ne
 * pas le trahir côté message.
 */
export const GENERIC_LOGIN_ERROR = "Identifiants incorrects.";
