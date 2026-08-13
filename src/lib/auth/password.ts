import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Hachage des mots de passe avec Argon2id.
 *
 * Argon2id plutôt que bcrypt : bcrypt tronque silencieusement au-delà de 72
 * octets (un mot de passe long serait équivalent à son préfixe) et n'a pas de
 * coût mémoire, ce qui le rend bien plus rentable à attaquer sur GPU.
 *
 * `server-only` en tête : ce module dépend d'un binding natif absent du
 * navigateur. L'importer depuis un composant client produirait une erreur de
 * résolution obscure au build ; la directive la remplace par un message
 * explicite. Les règles de politique et la jauge de force, qui doivent tourner
 * côté client, vivent dans `password-policy.ts`.
 */

// Paramètres OWASP (2024) pour Argon2id : 19 Mio, 2 itérations, p=1.
// Environ 50 ms par hash sur un CPU serveur courant — assez lent pour rendre
// le bruteforce coûteux, assez rapide pour ne pas dégrader le login.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Vérifie un mot de passe. Retourne false au lieu de propager si le hash est
 * malformé : une ligne corrompue en base ne doit pas faire tomber le login en
 * 500, ni révéler que ce compte est particulier.
 */
export async function verifyPassword(
  storedHash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(storedHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Hash factice, utilisé pour égaliser le temps de réponse du login quand
 * l'identifiant n'existe pas. Sans ça, répondre immédiatement sur un compte
 * inconnu et après ~50 ms sur un compte existant permet d'énumérer les
 * comptes au chronomètre.
 *
 * Généré au premier appel, puis mémoïsé.
 */
let dummyHashCache: string | null = null;

export async function dummyVerify(password: string): Promise<false> {
  if (!dummyHashCache) {
    dummyHashCache = await hashPassword("mot-de-passe-factice-jamais-utilise");
  }
  await verifyPassword(dummyHashCache, password);
  return false;
}
