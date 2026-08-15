import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";
import { TEXT_ANIMATIONS } from "@/lib/text-animations";

/**
 * Bloc de texte libre.
 *
 * Markdown restreint, jamais de HTML : le contenu est saisi par
 * l'utilisateur et rendu sur notre domaine. Autoriser du HTML brut ici
 * reviendrait à offrir un XSS stocké à tout visiteur de la page. Le renderer
 * (étape 4) n'interprète que gras, italique, souligné, barré et liens.
 */
const configSchema = z.object({
  content: z.string().max(2000).default(""),
  align: z.enum(["left", "center", "right"]).default("center"),
  size: z.enum(["xs", "sm", "md", "lg", "xl"]).default("md"),
  /** Applique la couleur d'accent du thème au lieu de la couleur de texte. */
  useAccentColor: z.boolean().default(false),
  italic: z.boolean().default(false),
  bold: z.boolean().default(false),
  /** Police du paragraphe. Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
  /** Animation du texte. Quand elle est active, le contenu est rendu brut
   * (le markdown n'est pas interprété : l'animation travaille sur la chaîne). */
  animation: z.enum(TEXT_ANIMATIONS).default("none"),
  /** Vitesse de l'animation, en millisecondes par caractère. */
  animationSpeed: z.number().min(20).max(500).default(80),
});

export type TextBlockConfig = z.infer<typeof configSchema>;

export const textBlock: BlockDefinition<TextBlockConfig> = {
  type: "text",
  label: "Texte",
  description: "Paragraphe libre en markdown simple.",
  icon: "type",
  category: "identity",
  configSchema,
  maxPerBiolink: null,
};
