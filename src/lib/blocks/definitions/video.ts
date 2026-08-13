import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Embed vidéo YouTube ou Twitch.
 *
 * Même principe que Spotify : plateforme + identifiant, jamais une URL
 * libre. L'iframe est reconstruite au rendu à partir d'une base connue.
 */
const configSchema = z.object({
  platform: z.enum(["youtube", "twitch_channel", "twitch_video"]).default("youtube"),
  /**
   * ID de vidéo YouTube (11 caractères), nom de chaîne Twitch, ou ID de
   * VOD Twitch. Le format exact est vérifié au rendu selon `platform`.
   */
  entityId: z.string().max(64).optional(),
  autoplay: z.boolean().default(false),
  /**
   * Le lecteur n'est chargé qu'au clic sur la vignette. Activé par défaut :
   * une iframe YouTube pèse plusieurs centaines de kilooctets et pose des
   * cookies avant même que le visiteur ait manifesté un intérêt.
   */
  lazyLoad: z.boolean().default(true),
  aspectRatio: z.enum(["16:9", "4:3", "1:1", "9:16"]).default("16:9"),
});

export type VideoBlockConfig = z.infer<typeof configSchema>;

export const videoBlock: BlockDefinition<VideoBlockConfig> = {
  type: "video",
  label: "Vidéo",
  description: "Intègre une vidéo YouTube ou un live Twitch.",
  icon: "video",
  category: "embeds",
  configSchema,
  maxPerBiolink: null,
  externalDependency: true,
};
