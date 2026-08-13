import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

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
  description: "Titre, sous-titre, bio et badges.",
  icon: "heading",
  category: "identity",
  configSchema,
  maxPerBiolink: 1,
};
