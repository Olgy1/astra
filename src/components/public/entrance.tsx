"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { resolveFontFamily } from "@/lib/theme/fonts";
import { signalEntered } from "@/components/public/entered";

/**
 * Écran d'entrée « cliquez pour entrer ».
 *
 * Volontairement simple : il ne s'affiche que si le propriétaire l'a activé
 * explicitement. La musique et la vidéo ne le déclenchent plus d'office — les
 * navigateurs bloquent l'audio avant une interaction de toute façon, et le
 * bouton de volume (en haut à gauche) sert justement à débloquer le son.
 *
 * Tant que le visiteur n'a pas cliqué, tout est en attente :
 *   - les animations CSS sont en pause (classe `astra-entrance-pending`) ;
 *   - la vidéo de fond, les particules et le titre « machine à écrire »
 *     attendent le signal d'entrée (voir entered.ts).
 * Tout se lance après le clic ; sans écran d'entrée, tout se lance dès
 * l'ouverture de la page.
 */
export function EntranceScreen({
  theme,
  children,
}: {
  theme: ThemeConfig;
  children: ReactNode;
}) {
  const shouldShow = theme.entranceScreen.enabled;
  const [entered, setEntered] = useState(!shouldShow);

  useEffect(() => {
    if (!entered) return;
    signalEntered();
  }, [entered]);

  return (
    <>
      {!entered && (
        <>
          {/* Fige toutes les animations tant que la page est couverte. */}
          <style>{`.astra-entrance-pending *, .astra-entrance-pending *::before, .astra-entrance-pending *::after { animation-play-state: paused !important; }`}</style>
          <button
            type="button"
            onClick={() => setEntered(true)}
            className="astra-entrance-btn fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/40 text-[var(--page-text)] transition-opacity"
            style={{ backdropFilter: `blur(${theme.entranceScreen.blurAmount}px)` }}
          >
            <span
              className="animate-pulse text-sm uppercase tracking-[0.3em]"
              style={{ fontFamily: resolveFontFamily(theme.entranceScreen.fontFamily, theme.typography.customFontUrl) }}
            >
              {theme.entranceScreen.text}
            </span>
          </button>
        </>
      )}

      {/* Le contenu est rendu dès le départ, seulement masqué : il est donc
          présent dans le HTML pour les moteurs de recherche et les aperçus de
          lien, qui ne cliquent pas. */}
      <div
        className={`transition-opacity duration-500 ${entered ? "" : "astra-entrance-pending"}`}
        style={{ opacity: entered ? 1 : 0 }}
        // aria-hidden tant que l'écran couvre la page : sans ça, un lecteur
        // d'écran lirait le contenu masqué derrière le bouton.
        aria-hidden={!entered}
      >
        {children}
      </div>
    </>
  );
}
