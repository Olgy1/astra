"use client";

import { useEditor } from "@/lib/editor/store";
import {
  SelectControl,
  SliderControl,
  ToggleControl,
} from "@/components/editor/controls";
import { MediaUpload } from "@/components/editor/media-upload";
import { displayNameFromFileName } from "@/lib/theme/font-name";

/**
 * Son de la page : audio de la vidéo de fond, pistes de musique et réglages
 * du lecteur.
 *
 * Tout ce qui concerne le son est regroupé ici (et non dans l'arrière-plan ou
 * les effets) : quand le son de la vidéo est activé, la vidéo EST la musique
 * de la page, et le choix d'un fichier audio disparaît — il n'y a pas deux
 * sons à la fois.
 */
export function MusicPanel() {
  const { biolink, updateTheme } = useEditor();
  const { theme } = biolink;

  return (
    <div className="flex flex-col gap-3">
        {/* Placement du lecteur quand plusieurs musiques sont configurées :
            intégré à la carte ou bloc séparé sous la carte. */}
        {theme.audio.tracks.some((track) => Boolean(track.url)) && !(theme.background.kind === "video" && theme.background.useVideoAudio) && (
          <SelectControl
            label="Emplacement du lecteur"
            value={theme.audio.placement}
            options={[
              { value: "card", label: "Dans la carte" },
              { value: "below", label: "Sous la carte" },
            ]}
            onChange={(placement) => updateTheme((c) => ({ ...c, audio: { ...c.audio, placement } }))}
          />
        )}
        {/* Le son d'une vidéo de fond se règle ici, avec les autres sons. Il
            passe au-dessus de « Choisir une musique » : quand il est activé,
            la vidéo EST la musique de la page, et le choix d'un fichier audio
            disparaît. */}
        {theme.background.kind === "video" && (
          <>
            <ToggleControl
              label="Son de la vidéo"
              description="Utilise l'audio de la vidéo de fond comme musique de la page."
              checked={theme.background.useVideoAudio}
              onChange={(useVideoAudio) => updateTheme((c) => (c.background.kind === "video" ? { ...c, background: { ...c.background, useVideoAudio } } : c))}
            />
            {theme.background.useVideoAudio && (
              <SliderControl label="Volume de la vidéo" value={theme.background.volume} min={0} max={1} step={0.05} onChange={(volume) => updateTheme((c) => (c.background.kind === "video" ? { ...c, background: { ...c.background, volume } } : c))} />
            )}
          </>
        )}

        {/* Quand le son de la vidéo est actif, on ne propose plus de musique
            séparée : le bouton de désactivation ci-dessus et son volume
            suffisent. */}
        {!(theme.background.kind === "video" && theme.background.useVideoAudio) && (
          <AudioTracksForm
            tracks={theme.audio.tracks}
            legacyUrl={theme.audio.url}
            enabled={theme.audio.enabled}
            volume={theme.audio.volume}
            setTracks={(tracks) =>
              updateTheme((c) => ({
                ...c,
                audio: {
                  ...c.audio,
                  tracks,
                  // url = première piste (champ historique conservé).
                  // `|| undefined` (et non `?? undefined`) : une piste vide
                  // (« Ajouter une piste » avant upload) a url = "", qui
                  // invaliderait `mediaUrl` et ferait retomber tout le thème
                  // sur le défaut — c'était le bug « tout se désactive ».
                  url: tracks[0]?.url || undefined,
                  enabled: tracks.length > 0 ? c.audio.enabled : false,
                },
              }))
            }
            onUploaded={(asset, index, fileName) =>
              updateTheme((c) => {
                const current =
                  c.audio.tracks.length > 0 ? c.audio.tracks : c.audio.url ? [{ url: c.audio.url }] : [];
                const tracks = [...current];
                // Titre par défaut = nom du fichier envoyé (pas l'UUID de
                // stockage). Si l'utilisateur a déjà saisi un titre, on le
                // conserve — le nom du fichier ne l'écrase pas.
                const derived = displayNameFromFileName(fileName);
                tracks[index] = {
                  ...tracks[index],
                  url: asset.url,
                  title: tracks[index].title || derived,
                };
                return {
                  ...c,
                  audio: {
                    ...c.audio,
                    tracks,
                    url: tracks[0]?.url || undefined,
                    enabled: true,
                  },
                };
              })
            }
            onEnabled={(enabled) => updateTheme((c) => ({ ...c, audio: { ...c.audio, enabled } }))}
            onVolume={(volume) => updateTheme((c) => ({ ...c, audio: { ...c.audio, volume } }))}
          />
        )}
    </div>
  );
}

/**
 * Édition des pistes de musique (plusieurs fichiers audio, avec titre).
 *
 * `legacyUrl` : URL d'une page créée avant l'arrivée de `tracks` — elle
 * s'affiche comme la piste 1 et se migre automatiquement dès la première
 * modification.
 */
function AudioTracksForm({
  tracks,
  legacyUrl,
  enabled,
  volume,
  setTracks,
  onUploaded,
  onEnabled,
  onVolume,
}: {
  tracks: { title?: string; url: string }[];
  legacyUrl?: string;
  enabled: boolean;
  volume: number;
  setTracks: (tracks: { title?: string; url: string }[]) => void;
  onUploaded: (asset: { id: string; url: string; key: string }, index: number, fileName?: string) => void;
  onEnabled: (enabled: boolean) => void;
  onVolume: (volume: number) => void;
}) {
  // Piste 0 = legacyUrl si `tracks` est vide (page d'avant la migration).
  const list =
    tracks.length > 0 ? tracks : legacyUrl ? [{ url: legacyUrl }] : [];

  function updateTitle(index: number, title: string) {
    const next = [...list];
    next[index] = { ...next[index], title: title || undefined };
    setTracks(next);
  }

  function removeTrack(index: number) {
    setTracks(list.filter((_, i) => i !== index));
  }

  return (
    <>
      {list.length === 0 && (
        <p className="text-xs text-content-muted">
          Aucune musique : ajoutez une ou plusieurs pistes ci-dessous.
        </p>
      )}

      {list.map((track, index) => (
        <div
          key={`${index}-${track.url.slice(0, 24)}`}
          className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-1 p-2"
        >
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-content-muted">Piste {index + 1}</span>
            <input
              value={track.title ?? ""}
              onChange={(event) => updateTitle(index, event.target.value)}
              placeholder="Titre (optionnel)"
              className="min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
            />
            {list.length > 1 && (
              <button
                type="button"
                onClick={() => removeTrack(index)}
                className="shrink-0 text-content-muted transition-colors hover:text-danger"
                aria-label={`Retirer la piste ${index + 1}`}
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              </button>
            )}
          </div>
          <MediaUpload
            type="AUDIO"
            currentUrl={track.url}
            onUploaded={(asset, fileName) => onUploaded(asset, index, fileName)}
            onCleared={list.length > 1 ? () => removeTrack(index) : undefined}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => setTracks([...list, { url: "" }])}
        className="self-start rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent"
      >
        + Ajouter une piste
      </button>

      {list.length > 0 && (
        <>
          <ToggleControl
            label="Activer la musique"
            checked={enabled}
            onChange={onEnabled}
          />
          <SliderControl
            label="Volume"
            value={volume}
            min={0}
            max={1}
            step={0.05}
            onChange={onVolume}
          />
        </>
      )}
    </>
  );
}
