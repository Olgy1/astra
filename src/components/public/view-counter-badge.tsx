"use client";

import { useEffect, useState } from "react";

/**
 * Compteur de vues intégré à la carte, dans un des quatre coins.
 *
 * Toujours affiché : ce n'est pas une option de thème mais une partie fixe de
 * la page, au même titre que le bouton « Signaler ». Seul le coin se règle.
 * Il écoute l'événement émis par `ViewTracker` — la réponse du POST /view
 * porte les compteurs frais, donc un premier visiteur voit « 1 vue » sans
 * recharger.
 *
 * Le style reprend celui du bouton « Signaler » (fond de la carte légèrement
 * translucide + flou, pastille ronde) pour se fondre dans le thème de la page.
 */

type ViewsDetail = { totalViews: number; uniqueViews: number };

const POSITIONS = {
  "top-left": "left-4 top-4",
  "top-right": "right-4 top-4",
  "bottom-left": "left-4 bottom-4",
  "bottom-right": "right-4 bottom-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
} as const;

export function ViewCounterBadge({
  position,
  compact,
  fontFamily,
  initialUnique,
  initialTotal,
}: {
  position: keyof typeof POSITIONS;
  compact: boolean;
  fontFamily?: string;
  initialUnique?: number;
  initialTotal?: number;
}) {
  // Vues uniques, pas toutes les visites : recharger la page ne fait pas
  // grimper le compteur. Repli sur le total pour les pages en cache datant
  // d'avant l'introduction du champ.
  const [display, setDisplay] = useState<number>(initialUnique ?? initialTotal ?? 0);

  useEffect(() => {
    function onViewCounted(event: Event) {
      const detail = (event as CustomEvent<ViewsDetail>).detail;
      if (typeof detail?.uniqueViews !== "number") return;
      setDisplay(detail.uniqueViews ?? detail.totalViews);
    }
    window.addEventListener("astra:views", onViewCounted);
    return () => window.removeEventListener("astra:views", onViewCounted);
  }, []);

  const formatted = compact
    ? new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(display)
    : new Intl.NumberFormat("fr-FR").format(display);

  return (
    <span
      className={`pointer-events-none absolute z-10 inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-medium tabular-nums ${POSITIONS[position]}`}
      style={{
        color: "var(--page-text)",
        // Même fond que la carte de base : opacité et flou identiques, pour
        // que la pastille s'y fonde au lieu d'afficher un voile différent.
        backgroundColor: "color-mix(in oklab, var(--card-bg) calc(var(--card-opacity) * 100%), transparent)",
        backdropFilter: "blur(var(--card-blur))",
        // Police dédiée si choisie ; absent = hérite de la police de la page.
        fontFamily,
      }}
    >
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 opacity-70" fill="currentColor" aria-hidden>
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      </svg>
      <span>
        {formatted} {display > 1 ? "vues" : "vue"}
      </span>
    </span>
  );
}
