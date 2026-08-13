import { z } from "zod";

/**
 * Politique de mot de passe : règles et estimation de force.
 *
 * Ce module est volontairement séparé de `password.ts`.
 *
 * `password.ts` importe `@node-rs/argon2`, un binding natif qui n'existe pas
 * dans le navigateur. La jauge de force et le schéma zod, eux, sont utilisés
 * par des composants client. Les garder dans le même fichier ferait entrer
 * Argon2 dans le bundle client, où le bundler échouerait à le résoudre — et
 * pas seulement pour la jauge : l'erreur casse toute la page.
 *
 * Règle à tenir : rien ici ne doit dépendre d'une API Node.
 */

/**
 * Mots de passe les plus courants, refusés quelle que soit leur complexité
 * apparente. Liste volontairement courte : elle attrape les pires cas sans
 * embarquer un dictionnaire de 100 000 entrées dans le bundle client. Pour
 * aller plus loin, brancher l'API k-anonymity de Have I Been Pwned côté
 * serveur.
 */
const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "123456789", "qwerty", "azerty",
  "abc123", "motdepasse", "111111", "1234567", "sunshine", "iloveyou",
  "princess", "admin", "welcome", "monkey", "login", "starwars",
  "dragon", "passw0rd", "master", "hello", "freedom", "whatever",
  "qazwsx", "trustno1", "letmein", "football", "baseball", "superman",
  "azertyuiop", "qwertyuiop", "motdepasse123", "password1", "password123",
]);

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Politique de mot de passe.
 *
 * On privilégie la longueur (10 caractères minimum) sur les règles de
 * composition byzantines : « Trois Chevaux Bleus Dansent » est plus solide et
 * plus mémorisable que « P@ssw0rd! ». On exige quand même deux classes de
 * caractères, ce qui écarte les saisies triviales sans pousser aux post-it.
 *
 * La borne haute existe pour empêcher un déni de service : Argon2 sur une
 * entrée de plusieurs mégaoctets consommerait du CPU pour rien.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`)
  .max(PASSWORD_MAX_LENGTH, `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`)
  .refine(
    (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
    "Ce mot de passe est trop courant. Choisissez-en un autre."
  )
  .refine((value) => {
    const classes = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /[0-9]/.test(value),
      /[^a-zA-Z0-9]/.test(value),
    ].filter(Boolean).length;
    return classes >= 2;
  }, "Le mot de passe doit combiner au moins deux types de caractères (minuscules, majuscules, chiffres, symboles).")
  .refine(
    (value) => !/^(.)\1+$/.test(value),
    "Le mot de passe ne peut pas être une répétition d'un seul caractère."
  );

export type PasswordStrength = {
  /** 0 (inutilisable) à 4 (excellent). */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  suggestions: string[];
};

/**
 * Estimation de force pour la jauge du formulaire.
 *
 * Purement indicative : elle guide l'utilisateur mais n'autorise rien. La
 * règle qui fait foi est `passwordSchema`, revérifiée côté serveur à chaque
 * inscription et changement de mot de passe.
 */
export function estimateStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  else suggestions.push(`Utilisez au moins ${PASSWORD_MIN_LENGTH} caractères.`);

  if (password.length >= 16) score++;
  else if (password.length >= PASSWORD_MIN_LENGTH) {
    suggestions.push("Un mot de passe plus long est nettement plus solide.");
  }

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;

  if (classes >= 2) score++;
  else suggestions.push("Mélangez majuscules, minuscules, chiffres ou symboles.");

  if (classes >= 3) score++;

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 0;
    suggestions.length = 0;
    suggestions.push("Ce mot de passe figure parmi les plus utilisés au monde.");
  }

  const clamped = Math.min(4, Math.max(0, score)) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Très faible", "Faible", "Moyen", "Bon", "Excellent"] as const;

  return { score: clamped, label: labels[clamped], suggestions };
}
