import type { ThemeConfig } from "@/lib/schemas/theme";

/**
 * Types et fonctions pures de la page publique.
 *
 * Séparé de `public.ts`, qui porte `server-only` (accès base et Redis). Ce
 * fichier-ci ne dépend d'aucune API serveur : il peut donc être importé
 * depuis un composant client — en l'occurrence l'aperçu de l'éditeur, qui
 * réutilise `PageShell`. Sans cette séparation, le bundle client tirerait
 * Prisma et ioredis, et le build échouerait.
 *
 * Même leçon que la scission password.ts / password-policy.ts.
 */

export type PublicLink = {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  position: number;
  clicks: number;
};

export type PublicBlock = {
  id: string;
  type: string;
  config: unknown;
  position: number;
};

export type PublicPage = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  theme: ThemeConfig;
  isPasswordProtected: boolean;
  /** Suspension de modération : tant que la date n'est pas passée, la page
      affiche un écran « page suspendue » au lieu du contenu. */
  suspendedUntil: string | null;
  suspensionReason: string | null;
  /** Toutes les visites (analytique interne). */
  totalViews: number;
  /** Un navigateur par fenêtre de 24 h — affiché par le compteur public. */
  uniqueViews: number;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  owner: {
    username: string;
    discordId: string | null;
    discordAvatar: string | null;
    /** Badges attribués par un admin (clés du catalogue lib/badges.ts). */
    badges: string[];
  };
  links: PublicLink[];
  blocks: PublicBlock[];
  media: { type: string; url: string }[];
};

/** URL d'un média par type, pour les blocks qui en dépendent. Fonction pure. */
export function mediaUrl(page: PublicPage, type: string): string | undefined {
  return page.media.find((asset) => asset.type === type)?.url;
}
