import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

const configSchema = z.object({
  /** URL du média uploadé (type AVATAR). Vide = initiale du pseudo. */
  imageUrl: z.string().url().optional(),
  /** Police du statut. Absent ou "inherit" = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
  /** Statut textuel court sous l'avatar. */
  statusText: z.string().max(40).optional(),
  statusEmoji: z.string().max(8).optional(),
});

export type AvatarBlockConfig = z.infer<typeof configSchema>;

export const avatarBlock: BlockDefinition<AvatarBlockConfig> = {
  type: "avatar",
  label: "Avatar",
  description: "Photo de profil, avec statut optionnel.",
  icon: "user-circle",
  category: "identity",
  configSchema,
  // La forme, la taille et la bordure vivent dans themeConfig.avatar : ce
  // sont des réglages d'apparence globale, pas du contenu de block.
  maxPerBiolink: 1,
};
