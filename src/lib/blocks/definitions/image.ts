import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

const configSchema = z.object({
  url: z.string().url().optional(),
  /** Texte alternatif : accessibilité, et affichage si l'image échoue. */
  alt: z.string().max(200).default(""),
  /** Rend l'image cliquable. */
  linkUrl: z.string().url().optional(),
  borderRadius: z.number().min(0).max(48).default(12),
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** Hauteur en pixels. Vide = ratio naturel de l'image. */
  height: z.number().min(40).max(600).optional(),
});

export type ImageBlockConfig = z.infer<typeof configSchema>;

export const imageBlock: BlockDefinition<ImageBlockConfig> = {
  type: "image",
  label: "Image",
  description: "Image libre, cliquable si besoin.",
  icon: "image",
  category: "identity",
  configSchema,
  maxPerBiolink: null,
};
