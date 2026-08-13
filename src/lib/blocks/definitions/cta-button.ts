import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

const configSchema = z.object({
  label: z.string().min(1).max(48).default("Cliquez ici"),
  url: z.string().url("URL invalide.").optional(),
  icon: z.string().max(32).optional(),
  variant: z.enum(["primary", "secondary", "outline", "gradient"]).default("primary"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  fullWidth: z.boolean().default(true),
  /** Animation d'appel permanente, pour attirer l'œil. */
  pulse: z.boolean().default(false),
  newTab: z.boolean().default(true),
  /** Police du libellé. Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
});

export type CtaButtonBlockConfig = z.infer<typeof configSchema>;

export const ctaButtonBlock: BlockDefinition<CtaButtonBlockConfig> = {
  type: "cta_button",
  label: "Bouton d'action",
  description: "Bouton mis en avant vers une destination unique.",
  icon: "mouse-pointer-click",
  category: "links",
  configSchema,
  maxPerBiolink: null,
};
