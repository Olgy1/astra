import type { ComponentType } from "react";
import type { BlockProps } from "@/components/blocks/types";
import type { PublicPage, PublicBlock } from "@/lib/biolinks/public-types";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { getBlockDefinition } from "@/lib/blocks/registry";

import { AvatarBlock, HeaderBlock, TextBlock, ImageBlock, DividerBlock } from "@/components/blocks/identity";
import { BadgesBlock } from "@/components/blocks/badges";
import { LinksBlock, SocialsBlock, CtaButtonBlock } from "@/components/blocks/links";
import { VideoBlock, SpotifyBlock, RedditBlock, DiscordServerBlock } from "@/components/blocks/embeds";
import { VisitCounterBlock, CountdownBlock } from "@/components/blocks/widgets";

/**
 * Table type → composant.
 *
 * C'est le pendant visuel du registry de l'étape 1. Ajouter un block =
 * ajouter une ligne ici, en plus de sa définition dans le registry. Les deux
 * tables sont volontairement séparées : le registry (validation, métadonnées)
 * est importé côté serveur pour valider les écritures, cette table ne l'est
 * que pour le rendu.
 *
 * `never` en type de config : chaque composant connaît son propre type, mais
 * la table est hétérogène. Le cast à l'usage est sûr parce que la config a
 * déjà été validée par le schéma zod de son type avant d'arriver en base.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RENDERERS: Record<string, ComponentType<BlockProps<any>>> = {
  avatar: AvatarBlock,
  badges: BadgesBlock,
  header: HeaderBlock,
  text: TextBlock,
  image: ImageBlock,
  divider: DividerBlock,
  links: LinksBlock,
  socials: SocialsBlock,
  cta_button: CtaButtonBlock,
  video: VideoBlock,
  spotify: SpotifyBlock,
  reddit: RedditBlock,
  discord_server: DiscordServerBlock,
  visit_counter: VisitCounterBlock,
  countdown: CountdownBlock,
};

/**
 * Rend un block, en revalidant sa config au passage.
 *
 * La config est relue depuis la base : une version antérieure du schéma a pu
 * la produire, ou une écriture directe a pu la corrompre. On la repasse par le
 * schéma du type, qui complète les champs manquants par leurs défauts. Une
 * config irrécupérable fait disparaître le block plutôt que planter la page —
 * un renderer qui jette ferait tomber tout le rendu serveur.
 */
export function BlockRenderer({
  block,
  page,
  theme,
}: {
  block: PublicBlock;
  page: PublicPage;
  theme: ThemeConfig;
}) {
  const Component = RENDERERS[block.type];
  const definition = getBlockDefinition(block.type);

  if (!Component || !definition) return null;

  const parsed = definition.configSchema.safeParse(block.config ?? {});
  if (!parsed.success) return null;

  return <Component config={parsed.data} page={page} theme={theme} />;
}
