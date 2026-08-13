"use client";

import { useMemo } from "react";
import type { PublicPage } from "@/lib/biolinks/public-types";
import { PageShell } from "@/components/public/page-shell";
import { useEditor, type EditorBiolink } from "@/lib/editor/store";

/**
 * Aperçu en temps réel.
 *
 * Convertit l'état de l'éditeur en `PublicPage` et le passe à `PageShell` —
 * le composant exact de la page publique. L'aperçu n'est donc pas une
 * approximation : c'est le rendu réel, à un `preview` près qui coupe le
 * comptage de vues et l'écran d'entrée.
 */
function toPublicPage(biolink: EditorBiolink): PublicPage {
  return {
    id: biolink.id,
    slug: biolink.slug,
    title: biolink.title,
    description: biolink.description,
    theme: biolink.theme,
    isPasswordProtected: biolink.isPasswordProtected,
    suspendedUntil: biolink.suspendedUntil,
    suspensionReason: biolink.suspensionReason,
    totalViews: 0,
    uniqueViews: 0,
    seoTitle: biolink.seoTitle,
    seoDescription: biolink.seoDescription,
    ogImageUrl: biolink.ogImageUrl,
    owner: biolink.owner,
    // Seuls les liens et blocks activés apparaissent, comme en public.
    links: biolink.links
      .filter((link) => link.isEnabled)
      .map(({ id, label, url, icon, position, clicks }) => ({ id, label, url, icon, position, clicks })),
    blocks: biolink.blocks
      .filter((block) => block.isEnabled)
      .map(({ id, type, config, position }) => ({ id, type, config, position })),
    media: biolink.media.map(({ type, url }) => ({ type, url })),
  };
}

export function LivePreview() {
  const { biolink } = useEditor();

  // Recalculé à chaque changement d'état : c'est ce qui rend l'aperçu vivant.
  // useMemo évite de reconstruire l'objet quand un rendu est déclenché par
  // autre chose que le biolink.
  const page = useMemo(() => toPublicPage(biolink), [biolink]);

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-border-subtle bg-black">
      {/* La clé force un remontage quand le fond ou la police change : ces
          effets ont un état interne (canvas de particules, @font-face) qui ne
          se met pas toujours à jour proprement par simple rerender. */}
      <div
        key={`${biolink.theme.background.kind}-${biolink.theme.typography.customFontUrl ?? ""}`}
        className="h-full overflow-y-auto"
      >
        <PageShell page={page} preview />
      </div>
    </div>
  );
}
