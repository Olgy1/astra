"use client";

import Link from "next/link";

/**
 * Coupe tout média de la page (vidéo de fond, musique d'ambiance) avant de
 * quitter la page. Sans ça, le son peut continuer à tourner pendant la
 * transition vers la page de signalement — c'est le cas qui gêne : on
 * signale, et la musique de la page signalée continue de jouer.
 */
function stopPageMedia() {
  document.querySelectorAll("audio, video").forEach((element) => {
    const media = element as HTMLMediaElement;
    media.pause();
    // load() libère la ressource (et coupe la lecture en cours de chargement).
    try {
      media.load();
    } catch {
      // ignore
    }
  });
}

/**
 * Bouton de signalement flottant, en bas à droite de la page.
 *
 * Reprend la personnalisation de la carte (fond, bordure via les variables
 * CSS du thème) pour se fondre dans la page, et affiche « Signaler » au
 * survol — la même bulle que les badges, dans la police du site (pas celle
 * de la page). Pas de contour avant le survol : la bordure n'apparaît qu'à
 * l'accent au survol. Mène à la page de signalement `/[slug]/report`, qui ne
 * demande aucune connexion.
 */
export function ReportButton({ slug }: { slug: string }) {
  return (
    <Link
      href={`/${slug}/report`}
      onClick={stopPageMedia}
      aria-label="Signaler cette page"
      className="group fixed bottom-4 right-4 z-40 inline-flex size-11 items-center justify-center rounded-full border border-transparent backdrop-blur-md transition-colors hover:border-[var(--page-accent)]"
      style={{
        // Les variables CSS du thème sont portées par `.astra-page` : ce
        // bouton est rendu à l'intérieur, il hérite donc de la carte.
        backgroundColor: "color-mix(in oklab, var(--card-bg) 85%, transparent)",
        color: "var(--page-muted)",
      }}
    >
      {/* Bouclier « signalement » : contour fin, point d'exclamation. */}
      <svg
        viewBox="0 0 24 24"
        className="size-5 transition-colors group-hover:text-[var(--page-accent)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3l7 3.5v5.5c0 4.6-3 8.5-7 9.5-4-1-7-4.9-7-9.5V6.5L12 3z" />
        <path d="M12 9v4" />
        <path d="M12 16.5h.01" />
      </svg>

      {/* Libellé au survol, comme les badges — au-dessus du bouton pour ne
          pas déborder hors de l'écran, le bouton étant en bas à droite.
          Police du site, pas celle de la page : c'est une marque de la
          plateforme, comme le pied de page. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded-full border border-transparent px-3 py-1 text-[11px] font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        style={{
          fontFamily: "var(--font-sans)",
          color: "var(--page-text)",
          backgroundColor: "color-mix(in oklab, var(--card-bg) calc(var(--card-opacity) * 100%), transparent)",
          backdropFilter: "blur(var(--card-blur))",
        }}
      >
        Signaler
      </span>
    </Link>
  );
}
