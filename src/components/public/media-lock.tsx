"use client";

import { useEffect, useRef } from "react";

/**
 * Verrou anti-pause de la vidéo de fond.
 *
 * La vidéo de fond (et, quand « le son vient de la vidéo », son audio) est
 * l'ambiance de la page : elle ne doit jamais s'arrêter. Ce composant
 * garantit qu'aucun visiteur ne peut la mettre en pause — un `pause` ou un
 * `ended` relance immédiatement la lecture.
 *
 * Volontairement restreint aux `<video>` : la MUSIQUE du lecteur (pistes
 * audio) reste entièrement contrôlable par le visiteur — Play/Pause, piste
 * précédente/suivante. Le premier verrou s'appliquait à tous les `audio` et
 * `video`, avalait les touches (espace, K, touches média) et détournait les
 * contrôles média du système : du coup Play/Pause sur la musique était
 * aussitôt contré par une relance, et « piste suivante » était en course
 * avec le handler `ended` du verrou. On ne verrouille plus que la vidéo.
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

    function resume(element: HTMLVideoElement) {
      // play() sur une vidéo en pause redémarre aussi une vidéo arrivée au
      // bout (`ended`) : le fond ne s'arrête jamais.
      if (element.paused) element.play().catch(() => {});
    }

    function attach(element: HTMLVideoElement) {
      element.addEventListener("pause", () => resume(element));
      element.addEventListener("ended", () => resume(element));
    }

    scope.querySelectorAll<HTMLVideoElement>("video").forEach(attach);

    // Des médias peuvent arriver après le montage (block monté plus tard) :
    // on attache le verrou aux nouveaux venus.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches("video")) {
            attach(node as HTMLVideoElement);
          } else {
            node.querySelectorAll<HTMLVideoElement>("video").forEach(attach);
          }
        }
      }
    });
    observer.observe(scope, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  return <div ref={rootRef} />;
}
