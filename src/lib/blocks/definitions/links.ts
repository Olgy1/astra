import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Ce block n'embarque pas les liens : ils vivent dans la table `links`, qui
 * porte le compteur de clics et l'ordre. Le config ne décrit que la
 * présentation.
 *
 * Pourquoi une table plutôt qu'un tableau dans le JSON : incrémenter un
 * compteur de clics dans un JSONB demande de relire, muter et réécrire tout
 * le document — sur une page virale, les écritures concurrentes s'écrasent
 * entre elles. Une ligne par lien rend l'incrément atomique.
 */
const configSchema = z.object({
  layout: z.enum(["list", "grid"]).default("list"),
  /** Colonnes en mode grid. Ignoré en mode list. */
  columns: z.number().min(2).max(4).default(2),
  buttonStyle: z.enum(["solid", "outlined", "ghost", "neon"]).default("solid"),
  showIcons: z.boolean().default(true),
  showClickCount: z.boolean().default(false),
  /** Police des libellés de liens. Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
  hoverEffect: z.enum(["none", "lift", "glow", "shine", "scale"]).default("lift"),
  /** Filtre les liens par leur `position`, pour découper la liste en sections. */
  positionRange: z
    .object({
      from: z.number().int().min(0).optional(),
      to: z.number().int().min(0).optional(),
    })
    .default({}),
});

export type LinksBlockConfig = z.infer<typeof configSchema>;

export const linksBlock: BlockDefinition<LinksBlockConfig> = {
  type: "links",
  label: "Liens",
  description: "Vos liens personnalisés, en liste ou en grille.",
  icon: "link",
  category: "links",
  configSchema,
  // Plusieurs instances permises : on peut vouloir une section "Mes réseaux"
  // et une section "Mes projets", découpées par positionRange.
  maxPerBiolink: null,
};
