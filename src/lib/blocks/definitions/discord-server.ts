import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Extrait le code d'invitation depuis une saisie libre : le code seul
 * (« abc123 ») ou une URL complète (« https://discord.gg/abc123 »,
 * « discord.com/invite/abc123 »). Retourne null si rien ne ressemble à une
 * invitation Discord.
 */
export function extractInviteCode(input: string): string | null {
  const trimmed = input.trim();
  // Code seul.
  if (/^[a-zA-Z0-9-]{2,32}$/.test(trimmed)) return trimmed;
  // URL complète, avec éventuel chemin/suffixe (/, ?, #).
  const match = trimmed.match(
    /(?:discord\.(?:gg|com\/invite)\/)([a-zA-Z0-9-]{2,32})(?:[\/?#].*)?$/i
  );
  return match ? match[1] : null;
}

const configSchema = z.object({
  /**
   * Code d'invitation seul (ex: "abc123"). À l'écriture on accepte aussi
   * l'URL complète (« https://discord.gg/abc123 ») : le transform la réduit
   * au code, et on reconstruit le lien au rendu — impossible d'injecter une
   * URL arbitraire sous couvert d'une carte « serveur Discord ».
   */
  inviteCode: z
    .string()
    .transform((value) => extractInviteCode(value) ?? value)
    .refine(
      (code) => /^[a-zA-Z0-9-]{2,32}$/.test(code),
      "Code d'invitation Discord invalide."
    )
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
  description: "Carte d'invitation avec icône, nom et compteurs du serveur.",
  icon: "discord",
  category: "embeds",
  configSchema,
  maxPerBiolink: null,
  externalDependency: true,
};
