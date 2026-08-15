"use client";

import { useRef, useState } from "react";
import type { MediaType } from "@prisma/client";
import { useEditor } from "@/lib/editor/store";
import { uploadFile, type UploadedAsset } from "@/lib/client-upload";

/**
 * Bouton d'upload d'un média, avec aperçu et suppression.
 *
 * En production (stockage S3/Backblaze), le fichier part en PUT direct vers
 * le stockage via une URL présignée — indispensable pour les vidéos de fond,
 * que la limite de body de Vercel (4,5 Mo) interdit de faire transiter par
 * le serveur. En local, on retombe sur l'upload par le serveur. Rend l'URL du
 * fichier à `onUploaded`, à charge de l'appelant de la brancher dans le
 * thème (avatar, fond, curseur…).
 */
const ACCEPT: Record<MediaType, string> = {
  AVATAR: "image/jpeg,image/png,image/webp,image/gif",
  BANNER: "image/jpeg,image/png,image/webp,image/gif",
  BACKGROUND: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm",
  AUDIO: "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm,audio/mp4,audio/aac,audio/flac,.mp3,.mpa,.wav,.ogg,.m4a,.aac,.flac",
  CURSOR: "image/png,image/gif,image/webp,image/x-icon,.cur,.ico",
  FONT: "font/woff,font/woff2,font/ttf,font/otf,.woff,.woff2,.ttf,.otf",
};

const LABELS: Record<MediaType, string> = {
  AVATAR: "Avatar",
  BANNER: "Bannière",
  BACKGROUND: "Fond",
  AUDIO: "Musique",
  CURSOR: "Curseur",
  FONT: "Police",
};

// « Musique », « Bannière » et « Police » sont féminins : l'article diffère.
const FEMININE: Partial<Record<MediaType, boolean>> = {
  AUDIO: true,
  BANNER: true,
  FONT: true,
};

export function MediaUpload({
  type,
  currentUrl,
  onUploaded,
  onCleared,
}: {
  type: MediaType;
  currentUrl?: string;
  /** Reçoit l'asset, et le nom de fichier d'origine (pour le titre d'une
   * piste ou le nom d'une police — l'URL stockée porte un UUID, pas le nom). */
  onUploaded: (asset: UploadedAsset, fileName?: string) => void;
  onCleared?: () => void;
}) {
  const { biolink } = useEditor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setProgress(0);

    const result = await uploadFile({
      file,
      type,
      biolinkId: biolink.id,
      onProgress: setProgress,
    });

    setUploading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onUploaded(result.asset, file.name);
  }

  const isVideo = currentUrl && /\.(mp4|webm)$/i.test(currentUrl);
  const isAudio = type === "AUDIO";

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[type]}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          // Réinitialise pour permettre de re-sélectionner le même fichier.
          event.target.value = "";
        }}
      />

      {currentUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-1 p-2">
          {isAudio ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-content-secondary">
              <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              Fichier audio chargé
            </span>
          ) : isVideo ? (
            <video src={currentUrl} className="size-12 rounded object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="size-12 rounded object-cover" />
          )}
          <span className="flex-1 truncate text-xs text-content-muted">{LABELS[type]} actuel</span>
          {onCleared && (
            <button
              type="button"
              onClick={onCleared}
              className="text-xs text-content-muted hover:text-danger"
            >
              Retirer
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-1 py-2.5 text-xs font-medium transition-colors hover:border-accent disabled:opacity-60"
      >
        {uploading ? `Envoi… ${progress}%` : `Choisir ${FEMININE[type] ? "une" : "un"} ${LABELS[type].toLowerCase()}`}
      </button>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
