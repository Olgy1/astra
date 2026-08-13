import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Validation des slugs (`monsite.com/pseudo`) et des pseudos.
 *
 * Le slug est la ressource la plus disputée de la plateforme : il est unique,
 * public, et court. Les règles ci-dessous sont volontairement strictes — on
 * peut toujours assouplir plus tard, l'inverse casserait des pages en ligne.
 */

export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 32;

/**
 * Chemins de l'application qui ne doivent jamais être capturés par une page
 * publique. Le routeur Next.js donne la priorité aux routes statiques sur la
 * route dynamique `/[slug]`, donc un utilisateur nommé "login" ne casserait
 * pas la page de login — mais sa page à lui deviendrait inaccessible. On
 * refuse ces slugs plutôt que de livrer une page fantôme.
 */
const SYSTEM_SLUGS = new Set([
  "api", "login", "register", "signup", "signin", "logout", "auth",
  "dashboard", "panel", "admin", "settings", "account", "profile",
  "verify", "reset", "forgot", "callback", "oauth",
  "about", "help", "support", "contact", "docs", "documentation",
  "terms", "privacy", "legal", "cgu", "cgv", "mentions",
  "pricing", "premium", "upgrade", "billing", "checkout",
  "explore", "discover", "search", "trending", "templates",
  "static", "assets", "public", "cdn", "media", "img", "images",
  "_next", "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
  "www", "mail", "ftp", "ns1", "ns2", "smtp",
  "null", "undefined", "true", "false",
]);

/**
 * Format d'un slug, et rien d'autre.
 *
 * Séparé de `slugSchema` à dessein : « ce lien est mal écrit » et « ce lien
 * est réservé » sont deux refus différents. Les confondre force l'appelant à
 * annoncer un problème de format là où le lien est parfaitement valide mais
 * simplement pris — voir `checkSlugAvailability`, qui distingue les motifs.
 */
export const slugFormatSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN_LENGTH, `Le lien doit faire au moins ${SLUG_MIN_LENGTH} caractères.`)
  .max(SLUG_MAX_LENGTH, `Le lien ne peut pas dépasser ${SLUG_MAX_LENGTH} caractères.`)
  .regex(
    /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/,
    "Le lien ne peut contenir que des lettres, chiffres, points, tirets et underscores, et doit commencer et finir par une lettre ou un chiffre."
  )
  .refine(
    (value) => !/[._-]{2,}/.test(value),
    "Le lien ne peut pas contenir deux caractères spéciaux consécutifs."
  );

/** True si le slug est un chemin de l'application. */
export function isSystemSlug(slug: string): boolean {
  return SYSTEM_SLUGS.has(slug.toLowerCase());
}

/**
 * Slug utilisable : format valide et non réservé au système.
 *
 * C'est ce schéma qu'utilisent les routes de création et de changement. Il ne
 * vérifie ni les réservations en base ni l'unicité — c'est le travail de
 * `checkSlugAvailability`.
 */
export const slugSchema = slugFormatSchema.refine(
  (value) => !SYSTEM_SLUGS.has(value),
  "Ce lien est réservé au fonctionnement du site."
);

/**
 * Pseudo de compte. Plus strict que le slug : ni point ni tiret, pour que
 * `@pseudo` reste sans ambiguïté et que deux pseudos ne se confondent pas
 * visuellement.
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Le pseudo doit faire au moins 3 caractères.")
  .max(32, "Le pseudo ne peut pas dépasser 32 caractères.")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Le pseudo ne peut contenir que des lettres, chiffres et underscores."
  )
  .refine(
    (value) => !SYSTEM_SLUGS.has(value.toLowerCase()),
    "Ce pseudo est réservé."
  );

export type SlugAvailability =
  | { available: true }
  | { available: false; reason: "TAKEN" | "RESERVED" | "PREMIUM"; message: string };

/**
 * Disponibilité d'un slug.
 *
 * Ne remplace pas la contrainte unique en base : entre ce contrôle et
 * l'INSERT, un autre utilisateur peut prendre le slug. L'appelant doit donc
 * traiter le code Prisma P2002 sur l'insertion. Cette fonction sert à donner
 * un message utile dans l'éditeur, pas à garantir l'exclusivité.
 *
 * `isAdmin` : un admin peut attribuer un slug PREMIUM, pas un slug RESERVED
 * (marques, insultes) — le rôle ne devrait pas rendre l'atteinte à un tiers
 * possible en un clic.
 */
export async function checkSlugAvailability(
  slug: string,
  options: { isAdmin?: boolean; excludeBiolinkId?: string } = {}
): Promise<SlugAvailability> {
  const normalized = slug.toLowerCase();

  // Les chemins de l'application sont refusés avant toute requête : ils ne
  // dépendent pas de la base, et le seed de `reserved_slugs` peut ne pas
  // avoir tourné — auquel cas la base seule les laisserait passer.
  if (SYSTEM_SLUGS.has(normalized)) {
    return {
      available: false,
      reason: "RESERVED",
      message: "Ce lien est réservé au fonctionnement du site.",
    };
  }

  const [existing, reserved, blacklisted] = await Promise.all([
    prisma.biolink.findUnique({
      where: { slug: normalized },
      select: { id: true },
    }),
    prisma.reservedSlug.findUnique({
      where: { slug: normalized },
      select: { tier: true, reason: true },
    }),
    // Blacklist de mots interdits : si le slug contient un mot de la liste
    // (insulte, marque...), il est refusé partout — même par un admin, comme
    // un slug RESERVED. La vérification se fait en base pour rester
    // synchronisée avec le panel admin.
    prisma.slugBlacklist.findMany({ select: { word: true } }),
  ]);

  if (existing && existing.id !== options.excludeBiolinkId) {
    return {
      available: false,
      reason: "TAKEN",
      message: "Ce lien est déjà utilisé.",
    };
  }

  const blockedWord = blacklisted.find((row) => normalized.includes(row.word))?.word;
  if (blockedWord) {
    return {
      available: false,
      reason: "RESERVED",
      message: `Ce lien contient un mot interdit (${blockedWord}).`,
    };
  }

  if (reserved) {
    if (reserved.tier === "PREMIUM") {
      if (options.isAdmin) return { available: true };
      return {
        available: false,
        reason: "PREMIUM",
        message: "Ce lien fait partie des liens premium et ne peut pas être choisi librement.",
      };
    }

    return {
      available: false,
      reason: "RESERVED",
      message: reserved.reason ?? "Ce lien est réservé.",
    };
  }

  return { available: true };
}

/** Propose des variantes disponibles quand le slug demandé est pris. */
export async function suggestAlternatives(
  slug: string,
  count = 3
): Promise<string[]> {
  const base = slug.toLowerCase().slice(0, SLUG_MAX_LENGTH - 4);
  const candidates = [
    `${base}1`,
    `${base}_`,
    `${base}${new Date().getFullYear() % 100}`,
    `real${base}`,
    `${base}x`,
    `its${base}`,
    `${base}${Math.floor(Math.random() * 900 + 100)}`,
  ]
    .filter((candidate) => slugSchema.safeParse(candidate).success)
    .slice(0, count * 3);

  if (candidates.length === 0) return [];

  const [taken, reserved] = await Promise.all([
    prisma.biolink.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    }),
    prisma.reservedSlug.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    }),
  ]);

  const unavailable = new Set([
    ...taken.map((row) => row.slug),
    ...reserved.map((row) => row.slug),
  ]);

  return candidates.filter((candidate) => !unavailable.has(candidate)).slice(0, count);
}

/** Liste des slugs systèmes, pour le seed de `reserved_slugs`. */
export function systemSlugs(): string[] {
  return [...SYSTEM_SLUGS];
}
