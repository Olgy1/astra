"use client";

import { useEffect, useRef } from "react";

/** Touches qui pilotent la lecture/pause, à neutraliser. */
const MEDIA_KEYS = new Set([
  "Space",
  "KeyK",
  "MediaPlayPause",
  "MediaTrackNext",
  "MediaTrackPrevious",
  "MediaStop",
]);

/**
 * Verrou anti-pause de la page publique.
 *
 * La vidéo de fond et la musique d'ambiance sont faites pour ne jamais
 * s'arrêter : c'est l'ambiance de la page. Ce composant garantit qu'aucun
 * visiteur ne peut les mettre en pause — ni via un lecteur (clic sur le
 * bouton pause), ni via le clavier (espace, K, touches média des rangées
 * fn), ni via les contrôles média du système (Media Session).
 *
 * Trois mécanismes complémentaires :
 *   - tout `pause` ou `ended` sur un média de la page relance la lecture ;
 *   - les touches de lecture/pause sont avalées au niveau de la fenêtre ;
 *   - les handlers Media Session déclarés ignorent la pause demandée par le
 *     système et relancent la lecture.
 *
 * Les lecteurs embarqués (YouTube, Twitch) sont des iframes tierces : leur
 * lecture échappe à ce composant. Le block Vidéo pose donc son propre verrou
 * au rendu (voir embeds.tsx), et Spotify reste volontairement libre — c'est
 * un widget que le visiteur lance lui-même.
 */
export function MediaLock() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const scope = root.closest(".astra-page") ?? document;

    function resume(element: HTMLMediaElement) {
      // play() sur un média en pause redémarre aussi un média arrivé au bout
      // (`ended`) : la musique et la vidéo de fond ne s'arrêtent jamais.
      if (element.paused) element.play().catch(() => {});
    }

    function attach(element: HTMLMediaElement) {
      element.addEventListener("pause", () => resume(element));
      element.addEventListener("ended", () => resume(element));
    }

    scope.querySelectorAll<HTMLMediaElement>("audio, video").forEach(attach);

    // Des médias peuvent arriver après le montage (block monté plus tard) :
    // on attache le verrou aux nouveaux venus.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches("audio, video")) {
            attach(node as HTMLMediaElement);
          } else {
            node.querySelectorAll<HTMLMediaElement>("audio, video").forEach(attach);
          }
        }
      }
    });
    observer.observe(scope, { childList: true, subtree: true });

    function onKeyDown(event: KeyboardEvent) {
      // Ne pas empêcher la saisie dans un champ de texte (il n'y en a
      // normalement pas sur une page bio, mais rester inoffensif coûte rien).
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      if (MEDIA_KEYS.has(event.code)) {
        event.preventDefault();
        event.stopPropagation();
        scope.querySelectorAll<HTMLMediaElement>("audio, video").forEach(resume);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);

    // Touches média routées par le navigateur via Media Session (Mac, certains
    // claviers, écouteurs) : déclarer un handler détourne la commande vers
    // nous au lieu de laisser le navigateur mettre en pause.
    let mediaSession: MediaSession | undefined;
    if ("mediaSession" in navigator) {
      mediaSession = navigator.mediaSession;
      const keepPlaying = () => {
        scope.querySelectorAll<HTMLMediaElement>("audio, video").forEach(resume);
      };
      for (const action of [
        "play",
        "pause",
        "stop",
        "previoustrack",
        "nexttrack",
        "seekbackward",
        "seekforward",
        "seekto",
      ] as const) {
        try {
          mediaSession.setActionHandler(action, keepPlaying);
        } catch {
          // Action non supportée par ce navigateur : on la laisse tranquille.
        }
      }
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown, true);
      if (mediaSession) {
        for (const action of [
          "play",
          "pause",
          "stop",
          "previoustrack",
          "nexttrack",
          "seekbackward",
          "seekforward",
          "seekto",
        ] as const) {
          try {
            mediaSession.setActionHandler(action, null);
          } catch {
            // ignore
          }
        }
      }
    };
  }, []);

  return <div ref={rootRef} />;
}
