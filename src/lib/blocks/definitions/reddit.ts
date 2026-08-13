import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

const configSchema = z.object({
  mode: z.enum(["subreddit", "post"]).default("subreddit"),
  /** Nom du subreddit, sans le préfixe "r/". */
  subreddit: z
    .string()
    .regex(/^[A-Za-z0-9_]{2,21}$/, "Nom de subreddit invalide.")
    .optional(),
  /** ID du post (base36) en mode "post". */
  postId: z
    .string()
    .regex(/^[a-z0-9]{4,12}$/, "Identifiant de post invalide.")
    .optional(),
  showThumbnails: z.boolean().default(true),
  /** Nombre de posts listés en mode "subreddit". */
  limit: z.number().min(1).max(10).default(3),
});

export type RedditBlockConfig = z.infer<typeof configSchema>;

export const redditBlock: BlockDefinition<RedditBlockConfig> = {
  type: "reddit",
  label: "Reddit",
  description: "Derniers posts d'un subreddit, ou un post précis.",
  icon: "reddit",
  category: "embeds",
  configSchema,
  maxPerBiolink: null,
  externalDependency: true,
};
