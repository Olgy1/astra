"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { onEntered, signalEntered } from "@/components/public/entered";
import { getSoundMuted, setSoundMuted } from "@/components/public/sound-state";

export type MusicTrack = { title?: string; url: string };

/** Nom d'affichage d'une piste : titre saisi, sinon nom du fichier. */
function trackLabel(track: MusicTrack, index: number): string {
  if (track.title) return track.title;
  try {
    const filename = decodeURIComponent(new URL(track.url).pathname.split("/").pop() ?? "");
    if (filename) return filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
  } catch {
    // URL illisible : on retombe sur un libellé neutre.
  }
  return `Piste ${index + 1}`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Lecteur de musique de la page, affiché quand plusieurs pistes (ou une
 * seule) sont définies et qu'aucune vidéo de fond ne fournit le son.
 *
 * Le widget est visible (titre, progression, piste précédente/suivante,
 * lecture/pause) — contrairement à un simple `<audio>` caché. L'élément
 * `<audio>` reste dans le DOM : le contrôle de volume flottant le pilote
 * toujours (mute/volume) via sa recherche de médias dans la page.
 *
 * La lecture est tentée au signal d'entrée (comme l'ancienne musique
 * d'ambiance) ; l'autoplay sonore reste soumis à la politique du navigateur.
 */
export function MusicPlayer({
  theme,
  tracks,
}: {
  theme: ThemeConfig;
  tracks: MusicTrack[];
}) {
  // Les pistes sans URL (ligne créée dans l'éditeur mais pas encore
  // uploadée) sont ignorées. Sans piste exploitable (ex. « Ajouter une
  // piste » puis activation avant upload), le lecteur ne s'affiche pas.
  const playable = tracks.filter((t) => t.url);
  const audioRef = useRef<HTMLAudioElement>(null);

  if (playable.length === 0) return null;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  // Le volume vit dans le lecteur (il remplace le bouton flottant quand il
  // est affiché). Coupé au départ, réactivé au signal d'entrée — même
  // comportement que le contrôle de volume qu'il remplace.
  const [muted, setMuted] = useState(() => getSoundMuted());
  const [volume, setVolume] = useState(theme.audio.volume);

  const track = playable[Math.min(index, playable.length - 1)];

  /** Applique le volume à la piste audio uniquement (jamais la vidéo). */
  function applySound(nextMuted: boolean, nextVolume: number) {
    setSoundMuted(nextMuted);
    const el = audioRef.current;
    if (!el) return;
    el.muted = nextMuted;
    el.volume = nextVolume;
    if (!nextMuted) el.play().catch(() => {});
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    applySound(next, volume);
  }

  function changeVolume(next: number) {
    setVolume(next);
    const nextMuted = next === 0;
    setMuted(nextMuted);
    applySound(nextMuted, next);
  }

  // La lecture a-t-elle déjà démarré (autoplay au signal d'entrée, ou clic
  // manuel) ? Quand oui, changer de piste relance aussitôt la suivante — le
  // son ne s'arrête pas au passage précédent/suivant.
  const startedRef = useRef(false);

  // Réinitialise la progression quand la piste change, et relance la lecture
  // si elle avait démarré. Pas au montage : les métadonnées (durée) arrivent
  // dès l'ouverture de la piste, et un reset au premier rendu les écraserait.
  const previousUrl = useRef(track?.url);
  useEffect(() => {
    if (previousUrl.current === track?.url) return;
    previousUrl.current = track?.url;
    setCurrentTime(0);
    setDuration(0);

    if (!startedRef.current) return;
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().then(() => setPlaying(true)).catch(() => {});
  }, [track?.url]);

  // La lecture démarre au signal d'entrée ; le play() peut échouer
  // (politique du navigateur, onglet en arrière-plan) — on l'avale. Le son
  // démarre activé (comportement historique du bouton de volume qu'il
  // remplace) sauf si le visiteur l'a déjà coupé.
  useEffect(() => {
    return onEntered(() => {
      const el = audioRef.current;
      if (!el) return;
      startedRef.current = true;
      setMuted(getSoundMuted());
      el.muted = getSoundMuted();
      el.volume = theme.audio.volume;
      el.play().then(() => setPlaying(true)).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlay() {
    // Ne pilote QUE la piste audio (`audioRef`) : jamais la vidéo de fond.
    // Une vidéo de fond continue de jouer pendant que Play/Pause lance ou
    // coupe la musique.
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      startedRef.current = true;
      el.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  /** Piste suivante : boucle sur la liste, sinon s'arrête à la dernière. */
  function next() {
    if (playable.length <= 1) return;
    setIndex((i) => (theme.audio.loop ? (i + 1) % playable.length : Math.min(i + 1, playable.length - 1)));
  }

  function prev() {
    if (playable.length <= 1) return;
    setIndex((i) => (theme.audio.loop ? (i - 1 + playable.length) % playable.length : Math.max(i - 1, 0)));
  }

  function seek(percent: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(duration) || duration <= 0) return;
    el.currentTime = (percent / 100) * duration;
    setCurrentTime(el.currentTime);
  }

  return (
    <div
      className="flex flex-col gap-2.5 p-3"
      style={{
        // Exactement les mêmes variables que la carte : opacité, flou,
        // couleur, arrondi et bordure. Le lecteur doit avoir l'air d'un
        // morceau de la carte, pas d'un widget posé à côté.
        borderRadius: "var(--card-radius)",
        backgroundColor: "color-mix(in oklab, var(--card-bg) calc(var(--card-opacity) * 100%), transparent)",
        backdropFilter: "blur(var(--card-blur))",
        border: "var(--card-border-width) solid var(--card-border-color)",
        boxShadow: "var(--card-shadow), var(--card-glow)",
      }}
    >
      {/* Titre de la piste courante. */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="var(--page-accent)" aria-hidden>
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium"
          style={{ color: "var(--page-accent)" }}
        >
          {trackLabel(track, index)}
        </span>
      </div>

      {/* Progression : temps écoulé, barre cliquable, durée totale. */}
      <div className="flex items-center gap-2">
        <span className="w-9 shrink-0 text-right text-[10px] tabular-nums" style={{ color: "var(--page-accent)" }}>
          {formatTime(currentTime)}
        </span>
        <div
          role="slider"
          aria-label="Progression"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={duration > 0 ? (currentTime / duration) * 100 : 0}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") seek(Math.min(100, ((currentTime + 5) / duration) * 100));
            if (event.key === "ArrowLeft") seek(Math.max(0, ((currentTime - 5) / duration) * 100));
          }}
          className="relative h-1.5 flex-1 cursor-pointer rounded-full"
          style={{ backgroundColor: "color-mix(in oklab, var(--page-text) 25%, transparent)" }}
          onPointerDown={(event) => {
            setSeeking(true);
            const rect = event.currentTarget.getBoundingClientRect();
            seek(((event.clientX - rect.left) / rect.width) * 100);
          }}
          onPointerMove={(event) => {
            if (!seeking) return;
            const rect = event.currentTarget.getBoundingClientRect();
            seek(((event.clientX - rect.left) / rect.width) * 100);
          }}
          onPointerUp={() => setSeeking(false)}
          onPointerLeave={() => setSeeking(false)}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              backgroundColor: "var(--page-accent)",
            }}
          />
          <span
            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full"
            style={{
              left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 5px)`,
              backgroundColor: "var(--page-accent)",
              boxShadow: "0 0 6px var(--page-accent)",
            }}
          />
        </div>
        <span className="w-9 shrink-0 text-[10px] tabular-nums" style={{ color: "var(--page-accent)" }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Volume fin : un mini-slider discret sous la progression, visible au
          survol. Le bouton de la rangée de contrôles coupe/réactive ; ici on
          ajuste. */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="size-3 shrink-0 opacity-60" fill="var(--page-accent)" aria-hidden>
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          aria-label="Volume"
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
          style={{ backgroundColor: "color-mix(in oklab, var(--page-text) 25%, transparent)", accentColor: "var(--page-accent)" }}
        />
      </div>

      {/* Contrôles : piste précédente, lecture/pause, piste suivante, et
          volume (couper/réactiver) — il remplace le bouton flottant.
          Chaque bouton est une pastille ronde de 44px : zone cliquable
          confortable, centrage symétrique autour du bouton de lecture. */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={prev}
          disabled={playable.length <= 1}
          aria-label="Piste précédente"
          className="flex size-11 items-center justify-center rounded-full text-[var(--page-accent)] transition-all duration-200 hover:scale-105 hover:bg-[color-mix(in_oklab,var(--page-accent)_18%,transparent)] active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Lecture"}
          className="flex size-11 items-center justify-center rounded-full text-[var(--page-accent)] transition-all duration-200 hover:scale-105 hover:bg-[color-mix(in_oklab,var(--page-accent)_18%,transparent)] active:scale-95"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={next}
          disabled={playable.length <= 1}
          aria-label="Piste suivante"
          className="flex size-11 items-center justify-center rounded-full text-[var(--page-accent)] transition-all duration-200 hover:scale-105 hover:bg-[color-mix(in_oklab,var(--page-accent)_18%,transparent)] active:scale-95 disabled:pointer-events-none disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
            <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
          </svg>
        </button>

        {/* Volume : icône couper/réactiver. Un réglage fin (slider) reste
            possible au-dessus — ici l'essentiel est le toggle. */}
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted || volume === 0 ? "Activer le son" : "Couper le son"}
          className="flex size-11 items-center justify-center rounded-full text-[var(--page-accent)] transition-all duration-200 hover:scale-105 hover:bg-[color-mix(in_oklab,var(--page-accent)_18%,transparent)] active:scale-95"
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
      </div>

      <audio
        ref={audioRef}
        src={track?.url}
        loop={theme.audio.loop && playable.length <= 1}
        preload="auto"
        onTimeUpdate={(event) => {
          const el = event.currentTarget;
          setCurrentTime(el.currentTime);
          // La durée peut ne pas remonter via l'événement loadedmetadata selon
          // le navigateur ; on la synchronise aussi ici (fréquent, léger).
          if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (playable.length > 1) next();
        }}
      />
    </div>
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
