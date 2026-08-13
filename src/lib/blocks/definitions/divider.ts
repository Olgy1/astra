import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

const configSchema = z.object({
  style: z.enum(["line", "dashed", "dotted", "gradient", "space"]).default("line"),
  /** Libellé centré sur le trait (ex: « Mes projets »). */
  label: z.string().max(40).optional(),
  thickness: z.number().min(1).max(8).default(1),
  spacing: z.number().min(4).max(64).default(16),
  opacity: z.number().min(0).max(1).default(0.3),
});

export type DividerBlockConfig = z.infer<typeof configSchema>;

export const dividerBlock: BlockDefinition<DividerBlockConfig> = {
  type: "divider",
  label: "Séparateur",
  description: "Trait ou espace entre deux sections.",
  icon: "minus",
  category: "identity",
  configSchema,
  maxPerBiolink: null,
};
