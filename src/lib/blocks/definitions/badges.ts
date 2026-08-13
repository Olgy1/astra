import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Badges de la page : pastilles attribuées par un admin (vérifié, admin…).
 *
 * La liste des badges possibles vit dans lib/badges.ts et les badges d'un
 * compte sur `User.badges`. Ce block ne fait qu'afficher ceux du propriétaire
 * — il ne permet pas d'en revendiquer : un badge auto-attribué ne vaudrait
 * rien. C'est un block comme les autres : ajoutable, retirable, positionnable.
 */
const configSchema = z.object({
  /** Police du libellé. Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
  /** Affichage : pastilles pleines ou simple contour. */
  style: z.enum(["filled", "outlined"]).default("filled"),
  /** Affiche aussi l'icône du badge quand elle existe. */
  showIcons: z.boolean().default(true),
});

export type BadgesBlockConfig = z.infer<typeof configSchema>;

export const badgesBlock: BlockDefinition<BadgesBlockConfig> = {
  type: "badges",
  label: "Badges",
  description: "Badges attribués par la plateforme (vérifié, admin…).",
  icon: "award",
  category: "identity",
  configSchema,
  maxPerBiolink: 1,
};
