import { z } from "zod";
import { themeConfigSchema } from "@/lib/schemas/theme";
import { slugSchema } from "@/lib/schemas/slug";

/**
 * Schémas des requêtes de gestion des biolinks.
 */

/**
 * URL d'un lien saisie par l'utilisateur.
 *
 * Liste blanche de protocoles, jamais de liste noire. Un `href` accepte
 * `javascript:alert(1)` et `data:text/html,<script>` : les deux exécutent du
 * code chez le visiteur, depuis notre domaine. Sur une plateforme dont le
 * principe même est d'héberger des liens fournis par des tiers, c'est le
 * contrôle le plus important du fichier.
 */
export const safeUrlSchema = z
  .string()
  .trim()
  .min(1, "L'URL est requise.")
  .max(2048, "URL trop longue.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "L'URL doit commencer par http:// ou https://");

export const createBiolinkSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
});

/**
 * Lien complet envoyé par l'éditeur à la sauvegarde (bouton Enregistrer).
 *
 * L'éditeur construit la liste localement (avec un id client) et l'envoie
 * en bloc ; le serveur la réconcilie avec la base (création, mise à jour,
 * suppression, ordre) dans une transaction.
 */
export const linkInputSchema = z.object({
  id: z.string().uuid("Identifiant invalide."),
  label: z.string().trim().min(1, "Le libellé est requis.").max(80),
  url: safeUrlSchema,
  icon: z.string().trim().max(255).nullable().optional(),
  isEnabled: z.boolean(),
  position: z.number().int().min(0),
});

/**
 * Block complet envoyé par l'éditeur à la sauvegarde. La config est validée
 * contre le schéma de son type côté serveur (`validateBlockConfig`).
 */
export const blockInputSchema = z.object({
  id: z.string().uuid("Identifiant invalide."),
  type: z.string().min(1).max(48),
  config: z.unknown().optional(),
  isEnabled: z.boolean(),
  position: z.number().int().min(0),
});

export const updateBiolinkSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    themeConfig: themeConfigSchema.optional(),
    isPublished: z.boolean().optional(),
    seoTitle: z.string().trim().max(120).nullable().optional(),
    seoDescription: z.string().trim().max(300).nullable().optional(),
    ogImageUrl: safeUrlSchema.nullable().optional(),
    // Listes complètes : envoyées seulement quand elles ont changé. Le serveur
    // réconcilie (création / mise à jour / suppression / ordre). Les clics ne
    // sont pas acceptés ici : c'est la route de comptage qui les incrémente.
    links: z.array(linkInputSchema).max(100).optional(),
    blocks: z.array(blockInputSchema).max(50).optional(),
  })
  // Un PATCH vide est presque toujours un bug côté client. Le refuser
  // explicitement vaut mieux que renvoyer 200 sans rien avoir fait.
  .refine((data) => Object.keys(data).length > 0, "Aucune modification fournie.");

export const changeSlugSchema = z.object({
  slug: slugSchema,
});

export const setPagePasswordSchema = z.object({
  // Le mot de passe d'une page publique n'est pas un mot de passe de compte :
  // il est souvent partagé, parfois jetable, et ne protège aucune donnée
  // personnelle. Appliquer `passwordSchema` ici serait une rigueur déplacée.
  password: z
    .string()
    .min(4, "Le mot de passe doit faire au moins 4 caractères.")
    .max(128, "Mot de passe trop long."),
});

export const unlockPageSchema = z.object({
  password: z.string().min(1).max(128),
});

// ---------------------------------------------------------------------------
// Liens
// ---------------------------------------------------------------------------

export const createLinkSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est requis.").max(80),
  url: safeUrlSchema,
  icon: z.string().trim().max(255).optional(),
});

export const updateLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    url: safeUrlSchema.optional(),
    icon: z.string().trim().max(255).nullable().optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Aucune modification fournie.");

/**
 * Réordonnancement.
 *
 * On prend la liste complète des identifiants dans leur ordre final, pas un
 * delta du type « déplacer B en position 2 ». Un delta obligerait le serveur
 * à recalculer les positions voisines, et deux déplacements simultanés se
 * marcheraient dessus. L'ordre complet rend l'opération idempotente : la
 * rejouer donne le même résultat.
 */
export const reorderSchema = z.object({
  ids: z
    .array(z.string().uuid("Identifiant invalide."))
    .min(1, "La liste est vide.")
    .max(200, "Trop d'éléments.")
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "La liste contient des doublons."
    ),
});

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export const createBlockSchema = z.object({
  // Validé contre le registry par `validateBlockConfig`, pas ici : la liste
  // des types vit dans le registry, la dupliquer en enum la ferait diverger.
  type: z.string().min(1).max(48),
  /** Optionnel : le registry fournit une config par défaut. */
  config: z.unknown().optional(),
});

export const updateBlockSchema = z
  .object({
    config: z.unknown().optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine(
    (data) => data.config !== undefined || data.isEnabled !== undefined,
    "Aucune modification fournie."
  );

// ---------------------------------------------------------------------------
// Médias
// ---------------------------------------------------------------------------

export const presignSchema = z.object({
  type: z.enum(["AVATAR", "BANNER", "AUDIO", "CURSOR", "BACKGROUND", "FONT"]),
  mimeType: z.string().min(1).max(128),
  // Le plafond générique suit la plus grande contrainte (fond vidéo 4K, 256 Mo) ;
  // les limites par type sont vérifiées ensuite par `validateUpload`.
  sizeBytes: z.number().int().positive().max(260 * 1024 * 1024),
  biolinkId: z.string().uuid().optional(),
});

export const confirmMediaSchema = z.object({
  key: z.string().min(1).max(512),
  type: z.enum(["AVATAR", "BANNER", "AUDIO", "CURSOR", "BACKGROUND", "FONT"]),
  biolinkId: z.string().uuid().optional(),
});
