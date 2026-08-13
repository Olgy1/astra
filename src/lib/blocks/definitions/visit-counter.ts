import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Compteur de visites. La valeur vient de `Biolink.uniqueViews` (un navigateur
 * par fenêtre de 24 h), jamais du config : sinon n'importe qui pourrait
 * s'afficher un million de vues.
 */
const configSchema = z.object({
  label: z.string().max(32).default("vues"),
  icon: z.string().max(32).default("eye"),
  /** Compte à rebours animé du chiffre au chargement. */
  animateOnLoad: z.boolean().default(true),
  /** 1 234 567 → "1,2 M". */
  compactNotation: z.boolean().default(false),
  style: z.enum(["inline", "badge", "card"]).default("badge"),
  /** Police du compteur. Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
});

export type VisitCounterBlockConfig = z.infer<typeof configSchema>;

export const visitCounterBlock: BlockDefinition<VisitCounterBlockConfig> = {
  type: "visit_counter",
  label: "Compteur de visites",
  description: "Nombre total de vues de votre page.",
  icon: "eye",
  category: "widgets",
  configSchema,
  maxPerBiolink: 1,
};
