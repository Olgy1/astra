"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { onEntered } from "@/components/public/entered";
import { setSoundMuted } from "@/components/public/sound-state";

/**
 * Contrôle de volume flottant, en haut à gauche de la page.
 *
 * Petit rectangle arrondi légèrement transparent : on le distingue aussi bien
 * sur un fond sombre que sur un fond clair.
 *
 * Pilote en temps réel le son de la page — qu'il vienne de la musique
 * d'ambiance (`<audio>`) ou de la piste d'une vidéo de fond (`<video>`). Il
 * agit directement sur ces éléments du DOM, ce qui le rend indépendant de la
 * source : peu importe qui joue, le contrôle s'applique.
 *
 * Ne s'affiche que si la page a effectivement du son.
 */
export function VolumeControl({
  theme,
  audioUrl,
}: {
  theme: ThemeConfig;
  audioUrl?: string;
}) {
  const hasMusic = theme.audio.enabled && Boolean(audioUrl);
  const hasVideoSound = theme.background.kind === "video" && theme.background.useVideoAudio;
  const initialVolume =
    theme.background.kind === "video" && theme.background.useVideoAudio
      ? theme.background.volume
      : theme.audio.volume;

  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(initialVolume);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /** Applique l'état à tous les éléments audio/vidéo de la page. */
  function apply(nextMuted: boolean, nextVolume: number) {
    // C'est la seule écriture de l'état partagé : les sources (vidéo de fond
    // notamment) le consultent quand elles redémarrent, pour ne pas relancer
    // un son que le visiteur a coupé.
    setSoundMuted(nextMuted);
    const scope = rootRef.current?.closest(".astra-page") ?? document;
    scope.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
      // On ne touche qu'aux médias porteurs de son : une vidéo de fond sans
      // audio doit rester muette quoi qu'il arrive.
      const carriesSound = el.tagName === "AUDIO" || hasVideoSound;
      if (!carriesSound) return;
      el.muted = nextMuted;
      el.volume = nextVolume;
      if (!nextMuted) el.play().catch(() => {});
    });
  }

  // Réapplique à l'entrée du visiteur : c'est à ce moment que les médias
  // commencent à jouer (autoplay sonore débloqué par le clic).
  useEffect(() => {
    return onEntered(() => {
      // Par défaut, entrer active le son au volume du thème.
      setMuted(false);
      apply(false, volume);
    });
    // volume est lu dans le callback au moment du signal ; on ne veut pas
    // ré-attacher l'abonnement à chaque cran de volume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retour au premier plan : la vidéo de fond (et éventuellement d'autres
  // mécanismes) relance les médias et peut avoir réinitialisé leur `muted`.
  // On ré-applique l'état voulu par le visiteur pour que le son reste coupé
  // s'il l'avait coupé — l'icône affichée n'est pas un simple ornement.
  useEffect(() => {
    function onVisibility() {
      if (!document.hidden) apply(muted, volume);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [muted, volume]);

  if (!hasMusic && !hasVideoSound) return null;

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    apply(next, volume);
  }

  function changeVolume(next: number) {
    setVolume(next);
    // Régler le volume au-dessus de zéro réactive le son s'il était coupé.
    const nextMuted = next === 0;
    setMuted(nextMuted);
    apply(nextMuted, next);
  }

  return (
    <div
      ref={rootRef}
      className="fixed left-4 top-4 z-40 flex items-center gap-2"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Activer le son" : "Couper le son"}
        className="flex items-center justify-center rounded-lg border border-white/20 bg-black/30 px-2.5 py-2 text-white backdrop-blur-md transition-colors hover:bg-black/45"
      >
        {muted || volume === 0 ? (
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
            <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>

      {/* Le curseur de volume n'apparaît qu'au survol, pour rester discret. */}
      <div
        className={`overflow-hidden transition-all ${expanded ? "w-24 opacity-100" : "w-0 opacity-0"}`}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          aria-label="Volume"
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
        />
      </div>
    </div>
  );
}
