import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

const configSchema = z.object({
  title: z.string().max(80).optional(),
  /**
   * Date cible en ISO 8601 avec fuseau (ex: "2026-12-25T00:00:00Z").
   * Stockée en UTC : un compte à rebours calculé sur l'heure locale du
   * serveur afficherait une valeur différente selon le visiteur.
   */
  targetDate: z.string().datetime({ offset: true }).optional(),
  /** Message affiché une fois la date atteinte. */
  expiredText: z.string().max(80).default("C'est parti !"),
  showDays: z.boolean().default(true),
  showHours: z.boolean().default(true),
  showMinutes: z.boolean().default(true),
  showSeconds: z.boolean().default(true),
  style: z.enum(["boxes", "inline", "minimal"]).default("boxes"),
  /** Police des chiffres et du titre. Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
});

export type CountdownBlockConfig = z.infer<typeof configSchema>;

export const countdownBlock: BlockDefinition<CountdownBlockConfig> = {
  type: "countdown",
  label: "Compte à rebours",
  description: "Décompte jusqu'à une date : sortie, stream, événement.",
  icon: "clock",
  category: "widgets",
  configSchema,
  maxPerBiolink: null,
};
