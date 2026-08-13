import type { PublicPage } from "@/lib/biolinks/public-types";
import type { ThemeConfig } from "@/lib/schemas/theme";

/**
 * Props communes à tous les renderers de blocks.
 *
 * Le block reçoit sa config typée, la page entière, et le thème. Il ne fait
 * aucune requête : la page publique est rendue en une passe côté serveur, et
 * un block qui irait chercher ses données lui-même multiplierait les
 * allers-retours à la base sur le chemin le plus chaud du site.
 */
export type BlockProps<TConfig> = {
  config: TConfig;
  page: PublicPage;
  theme: ThemeConfig;
};
