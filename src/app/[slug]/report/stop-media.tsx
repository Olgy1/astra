"use client";

import { useEffect } from "react";
import { resetEntered } from "@/components/public/entered";

/**
 * Coupe tout média resté actif sur la page de signalement.
 *
 * La navigation depuis la page bio doit démonter la vidéo de fond et la
 * musique — c'est le cas normal — mais une transition lente ou un retour
 * via le cache du navigateur (bfcache) peut laisser un élément qui joue
 * encore. Au montage (et à chaque `pageshow`, qui couvre les restaurations
 * bfcache), on coupe tout : la page de signalement doit être silencieuse.
 */
export function StopMedia() {
  useEffect(() => {
    function stop() {
      document.querySelectorAll("audio, video").forEach((element) => {
        const media = element as HTMLMediaElement;
        media.pause();
        try {
          media.load();
        } catch {
          // ignore
        }
      });
    }

    stop();
    window.addEventListener("pageshow", stop);
    return () => {
      window.removeEventListener("pageshow", stop);
      // En quittant la page de signalement (annuler ou confirmation), on remet
      // le signal d'entrée à zéro : la page bio rechargée redémarre la vidéo
      // depuis le début, comme une première visite.
      resetEntered();
    };
  }, []);

  return null;
}
