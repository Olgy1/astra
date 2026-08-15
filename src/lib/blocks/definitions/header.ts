import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";
import { TEXT_ANIMATIONS } from "@/lib/text-animations";

/** Tailles disponibles pour chacune des zones de l'en-tête. */
export const HEADER_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"] as const;
export type HeaderSize = (typeof HEADER_SIZES)[number];

const configSchema = z.object({
  /** Vide = on retombe sur `Biolink.title`. */
  title: z.string().max(120).optional(),
  subtitle: z.string().max(200).optional(),
  /** Vide = on retombe sur `Biolink.description`. */
  bio: z.string().max(500).optional(),
  /** Bio au-dessus du sous-titre (sinon le sous-titre passe en premier). */
  bioBeforeSubtitle: z.boolean().default(false),
  showUsername: z.boolean().default(true),
  /** Police par défaut du block (titre, sous-titre, bio). Absent = police globale. */
  fontFamily: z.string().max(64).optional(),
  /** Polices individuelles. Absentes = police du block, puis police globale. */
  titleFontFamily: z.string().max(64).optional(),
  subtitleFontFamily: z.string().max(64).optional(),
  bioFontFamily: z.string().max(64).optional(),
  /** Tailles individuelles : titre, sous-titre et bio se règlent séparément. */
  titleSize: z.enum(HEADER_SIZES).default("2xl"),
  subtitleSize: z.enum(HEADER_SIZES).default("sm"),
  bioSize: z.enum(HEADER_SIZES).default("sm"),
  /**
   * Police custom uploadée, propre au block En-tête (le pseudo). La police
   * globale de la page n'accepte plus d'upload : seule cette zone peut
   * utiliser une police personnalisée, via la valeur "custom".
   */
  customFontUrl: z
    .string()
    .url("URL invalide.")
    .refine(
      (value) => value.startsWith("https://") || value.startsWith("http://"),
      "Seules les URL http(s) sont acceptées."
    )
    .optional(),
  /** Nom d'affichage de la police custom, dérivé du nom du fichier. */
  customFontName: z.string().max(64).optional(),
  /** Animation de la bio. Indépendante de l'animation du titre (thème). */
  bioAnimation: z.enum(TEXT_ANIMATIONS).default("none"),
  /** Vitesse de l'animation de la bio, en millisecondes par caractère. */
  bioAnimationSpeed: z.number().min(20).max(500).default(80),
  /**
   * Badges décoratifs. Distincts des badges de rôle (admin, vérifié), qui
   * sont attribués par la plateforme et non déclarés par l'utilisateur.
   */
  badges: z
    .array(
      z.object({
        label: z.string().max(24),
        color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        icon: z.string().max(32).optional(),
      })
    )
    .max(6, "Six badges maximum.")
    .default([]),
});

export type HeaderBlockConfig = z.infer<typeof configSchema>;

export const headerBlock: BlockDefinition<HeaderBlockConfig> = {
  type: "header",
  label: "En-tête",
  description: "Titre, sous-titre et bio, tailles et polices par zone.",
  icon: "heading",
  category: "identity",
  configSchema,
  maxPerBiolink: 1,
};
