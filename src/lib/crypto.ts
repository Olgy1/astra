import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Chiffrement symétrique des secrets stockés en base.
 *
 * Utilisé pour les secrets TOTP. Un mot de passe se hache (à sens unique),
 * mais un secret TOTP doit être relu en clair à chaque vérification de code :
 * il faut donc du chiffrement réversible, pas du hachage.
 *
 * AES-256-GCM plutôt que CBC : le mode GCM est authentifié. Un attaquant qui
 * aurait un accès en écriture à la base ne peut pas modifier un secret
 * chiffré sans que le déchiffrement échoue — avec CBC, il pourrait retourner
 * des bits du clair sans être détecté.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, taille recommandée pour GCM
const AUTH_TAG_LENGTH = 16;

function key(): Buffer {
  return Buffer.from(serverEnv().ENCRYPTION_KEY, "base64");
}

/**
 * Chiffre une chaîne. Format de sortie : `iv.authTag.ciphertext`, chaque
 * partie en base64url.
 *
 * L'IV est aléatoire à chaque appel et stocké en clair à côté du chiffré —
 * c'est le fonctionnement normal : l'IV n'est pas un secret, il doit
 * seulement être unique. Réutiliser un IV avec la même clé en GCM permettrait
 * de retrouver le clair.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Déchiffre une chaîne produite par `encrypt`.
 *
 * Lance si le format est invalide, si la clé est mauvaise, ou si le chiffré a
 * été altéré (le tag d'authentification ne colle plus). L'appelant doit
 * traiter l'échec : en pratique, cela signifie que `ENCRYPTION_KEY` a changé
 * et que le secret est irrécupérable.
 */
export function decrypt(payload: string): string {
  const parts = payload.split(".");

  if (parts.length !== 3) {
    throw new Error("Format de chiffré invalide.");
  }

  const [ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(dataPart, "base64url");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Chiffré malformé : IV ou tag de taille incorrecte.");
  }

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8"
  );
}

/**
 * Empreinte anonyme d'un visiteur, pour dédoublonner les vues et les
 * déverrouillages de page sans poser de cookie ni stocker d'IP.
 *
 * L'IP brute est une donnée personnelle au sens du RGPD. On la hache avec un
 * sel serveur : le résultat permet de reconnaître le même visiteur pendant
 * la fenêtre de comptage, mais ne permet pas de remonter à l'IP — sauf à
 * énumérer les 4 milliards d'IPv4, ce que le sel secret rend inutile puisque
 * la table obtenue serait invalide pour un autre déploiement.
 */
export function visitorHash(ip: string, userAgent: string): string {
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${serverEnv().ENCRYPTION_KEY}`)
    .digest("base64url")
    .slice(0, 22);
}
