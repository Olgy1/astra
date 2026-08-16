import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Compteur de visites. La valeur vient de `Biolink.uniqueViews` (une adresse
 * IP par fenêtre de 24 h), jamais du config : sinon n'importe qui pourrait
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

/**
 * Accord du libellé avec le compteur : « 0 vue », « 1 vue », « 2 vues ».
 * Le libellé par défaut (« vues ») est au pluriel : on retire le « s » quand
 * le compte vaut 0 ou 1. Pour un libellé personnalisé, on ajoute un « s »
 * dès que le compte vaut 0 ou plus de 1 (repli simple et prévisible).
 */
export function pluralizeLabel(label: string, count: number): string {
  if (label === "vues") return count === 0 || count === 1 ? "vue" : "vues";
  if (count === 1) return label.replace(/s$/i, "");
  return label;
}

export const visitCounterBlock: BlockDefinition<VisitCounterBlockConfig> = {
  type: "visit_counter",
  label: "Compteur de visites",
  description: "Nombre total de vues de votre page.",
  icon: "eye",
  category: "widgets",
  configSchema,
  maxPerBiolink: 1,
};
