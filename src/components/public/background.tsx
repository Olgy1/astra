"use client";

import { useEffect, useRef } from "react";
import type { Background } from "@/lib/schemas/theme";
import {
  backgroundBlur,
  backgroundOverlayStyle,
  backgroundStyle,
} from "@/lib/theme/css";
import { onEntered } from "@/components/public/entered";

/**
 * Calque d'arrière-plan : couleur, dégradé, image ou vidéo.
 *
 * `fixed inset-0` et non un fond sur `<body>` : le flou et le voile
 * d'assombrissement doivent s'appliquer à l'image seule, pas au contenu
 * par-dessus. Un `backdrop-filter` sur le body flouterait aussi le texte.
 *
 * La vidéo ne démarre qu'au signal d'entrée (voir entered.ts) : sans écran
 * d'entrée il est émis au montage, avec écran d'entrée il est émis au clic.
 * Le son éventuel suit la même règle — un autoplay sonore serait bloqué par
 * le navigateur avant interaction de toute façon.
 */
export function PageBackground({ background }: { background: Background }) {
  const blur = backgroundBlur(background);
  const overlay = backgroundOverlayStyle(background);
  const videoRef = useRef<HTMLVideoElement>(null);

  const wantsSound = background.kind === "video" && background.useVideoAudio;
  const videoVolume = background.kind === "video" ? background.volume : 0.5;
  const videoUrl = background.kind === "video" ? background.url : undefined;

  useEffect(() => {
    if (background.kind !== "video") return;
    const video = videoRef.current;
    if (!video) return;

    function start() {
      if (!video) return;
      video.muted = !wantsSound;
      video.volume = wantsSound ? videoVolume : 1;
      video.play().catch(() => {
        // Le navigateur a refusé le son (pas encore d'interaction) : on
        // repasse muet pour au moins garder l'image, plutôt que de bloquer
        // toute la lecture.
        video.muted = true;
        video.play().catch(() => {});
      });
    }

    return onEntered(start);
  }, [background.kind, wantsSound, videoVolume, videoUrl]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {background.kind === "video" ? (
        <video
          ref={videoRef}
          src={background.url}
          // Pas d'autoPlay : la lecture est déclenchée par le signal d'entrée.
          // Avec un écran d'entrée, la vidéo ne doit pas se lancer avant le
          // clic ; sans écran d'entrée, le signal est émis au montage et la
          // vidéo démarre immédiatement.
          muted
          loop
          playsInline
          preload="auto"
          className="size-full object-cover"
          style={blur ? { filter: blur } : undefined}
        />
      ) : (
        <div
          className="size-full"
          style={{
            ...backgroundStyle(background),
            ...(blur ? { filter: blur, transform: "scale(1.1)" } : {}),
            // scale(1.1) avec le flou : sans ça, le flou révèle les bords
            // transparents de l'image et dessine un liseré clair au pourtour.
          }}
        />
      )}

      {overlay && <div className="absolute inset-0" style={overlay} />}
    </div>
  );
}
