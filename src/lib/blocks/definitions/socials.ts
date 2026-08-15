import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Réseaux reconnus. Chaque plateforme a son icône et son schéma d'URL ;
 * en ajouter une = ajouter une entrée ici et l'icône correspondante.
 */
export const SOCIAL_PLATFORMS = [
  "discord",
  "instagram",
  "tiktok",
  "twitter",
  "youtube",
  "twitch",
  "spotify",
  "github",
  "telegram",
  "snapchat",
  "steam",
  "roblox",
  "kick",
  "soundcloud",
  "reddit",
  "pinterest",
  "linkedin",
  "namemc",
  "email",
  "website",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const configSchema = z.object({
  entries: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORMS),
        /**
         * Pseudo ou URL complète, selon la plateforme. La normalisation
         * (`@pseudo` → URL) est faite au rendu : stocker la saisie brute
         * permet de la réafficher telle quelle dans l'éditeur.
         */
        value: z.string().min(1).max(2048),
        /** Ouvre dans un nouvel onglet. */
        newTab: z.boolean().default(true),
      })
    )
    .max(24, "Vingt-quatre réseaux maximum.")
    .default([]),

  iconSize: z.number().min(16).max(64).default(28),
  gap: z.number().min(4).max(32).default(12),
  style: z.enum(["plain", "filled", "outlined"]).default("plain"),
  /** Colore chaque icône aux couleurs de sa marque. */
  useBrandColors: z.boolean().default(false),
  hoverEffect: z.enum(["none", "lift", "glow", "bounce"]).default("lift"),
});

export type SocialsBlockConfig = z.infer<typeof configSchema>;

export const socialsBlock: BlockDefinition<SocialsBlockConfig> = {
  type: "socials",
  label: "Réseaux sociaux",
  description: "Rangée d'icônes vers vos profils.",
  icon: "share",
  category: "links",
  configSchema,
  maxPerBiolink: 1,
};
