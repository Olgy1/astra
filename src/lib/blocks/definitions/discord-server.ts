import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

const configSchema = z.object({
  /**
   * Code d'invitation seul (ex: "abc123"), pas l'URL complète : on
   * reconstruit le lien au rendu, ce qui empêche d'injecter une URL
   * arbitraire sous couvert d'une carte "serveur Discord".
   */
  inviteCode: z
    .string()
    .regex(/^[a-zA-Z0-9-]{2,32}$/, "Code d'invitation Discord invalide.")
    .optional(),
  showMemberCount: z.boolean().default(true),
  showOnlineCount: z.boolean().default(true),
  showIcon: z.boolean().default(true),
  buttonLabel: z.string().max(32).default("Rejoindre"),
  /** Police du libellé du bouton. Absent = police globale de la page. */
  fontFamily: z.string().max(64).optional(),
});

export type DiscordServerBlockConfig = z.infer<typeof configSchema>;

export const discordServerBlock: BlockDefinition<DiscordServerBlockConfig> = {
  type: "discord_server",
  label: "Serveur Discord",
  description: "Carte d'invitation avec compteur de membres.",
  icon: "discord",
  category: "embeds",
  configSchema,
  maxPerBiolink: null,
  externalDependency: true,
};
