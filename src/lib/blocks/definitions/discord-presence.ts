import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Présence Discord temps réel : statut, activité en cours, écoute Spotify.
 *
 * L'ID Discord n'est pas dans le config : il est lu depuis `User.discordId`
 * du propriétaire. Le laisser saisir librement permettrait d'afficher la
 * présence de n'importe qui — usurpation d'identité triviale.
 */
const configSchema = z.object({
  showActivity: z.boolean().default(true),
  showSpotify: z.boolean().default(true),
  /** Affiche le nom du serveur Discord principal. */
  showGuild: z.boolean().default(false),
  /** Vignette du jeu ou de l'app en cours. */
  showLargeImage: z.boolean().default(true),
  compact: z.boolean().default(false),
  /** Police des textes (nom, activité). Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
});

export type DiscordPresenceBlockConfig = z.infer<typeof configSchema>;

export const discordPresenceBlock: BlockDefinition<DiscordPresenceBlockConfig> = {
  type: "discord_presence",
  label: "Présence Discord",
  description: "Votre statut et votre activité Discord, en direct.",
  icon: "discord",
  category: "widgets",
  configSchema,
  maxPerBiolink: 1,
  externalDependency: true,
};
