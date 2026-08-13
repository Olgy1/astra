import { z } from "zod";
import type { BlockDefinition } from "@/lib/blocks/types";

/**
 * Embed Spotify (titre, album, playlist ou artiste).
 *
 * On stocke le type et l'ID séparément plutôt qu'une URL : l'iframe est
 * construite au rendu à partir de `open.spotify.com/embed/{type}/{id}`, donc
 * aucune URL fournie par l'utilisateur n'atterrit dans un `src` d'iframe.
 */
const configSchema = z.object({
  entityType: z.enum(["track", "album", "playlist", "artist"]).default("track"),
  /** ID Spotify : 22 caractères base62. */
  entityId: z
    .string()
    .regex(/^[a-zA-Z0-9]{22}$/, "Identifiant Spotify invalide (22 caractères attendus).")
    .optional(),
  theme: z.enum(["dark", "light"]).default("dark"),
  compact: z.boolean().default(false),
});

export type SpotifyBlockConfig = z.infer<typeof configSchema>;

export const spotifyBlock: BlockDefinition<SpotifyBlockConfig> = {
  type: "spotify",
  label: "Spotify",
  description: "Intègre un titre, un album ou une playlist.",
  icon: "spotify",
  category: "embeds",
  configSchema,
  maxPerBiolink: null,
  externalDependency: true,
};
