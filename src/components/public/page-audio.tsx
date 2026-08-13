"use client";

import { useEffect, useRef } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { onEntered, signalEntered } from "@/components/public/entered";

/**
 * Musique d'ambiance de la page.
 *
 * L'élément `<audio>` existe dès le départ (il faut qu'il soit dans le DOM
 * pour que le contrôle de volume le pilote), mais la lecture n'est tentée
 * qu'au signal d'entrée. Sans écran d'entrée, le signal est émis au montage :
 * la tentative d'autoplay échouera silencieusement si le navigateur l'exige,
 * et le bouton de volume prendra le relais.
 */
export function PageAudio({
  theme,
  audioUrl,
}: {
  theme: ThemeConfig;
  audioUrl: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    return onEntered(() => {
      if (!ref.current) return;
      ref.current.volume = theme.audio.volume;
      // Le play() peut encore échouer (politique du navigateur, onglet en
      // arrière-plan). On avale l'échec : une page sans musique reste une
      // page.
      ref.current.play().catch(() => {});
    });
  }, [theme.audio.volume]);

  return (
    <audio
      ref={ref}
      src={audioUrl}
      loop={theme.audio.loop}
      preload="auto"
    />
  );
}

/**
 * Signal d'entrée émis au montage, en mode aperçu de l'éditeur.
 *
 * L'aperçu n'a pas d'écran d'entrée (il masquerait les réglages en cours),
 * mais la vidéo de fond, les particules et la machine à écrire attendent le
 * signal pour démarrer. Ce composant le donne dès le premier rendu, comme le
 * ferait un écran d'entrée absent.
 */
export function PreviewAutoplay() {
  useEffect(() => {
    signalEntered();
  }, []);

  return null;
}
