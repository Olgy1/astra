"use client";

import { useRef, useState } from "react";
import type { MediaType } from "@prisma/client";
import { useEditor } from "@/lib/editor/store";

/**
 * Bouton d'upload d'un média, avec aperçu et suppression.
 *
 * Passe par /api/media/upload (upload direct par le serveur), qui fonctionne
 * en stockage local comme en S3. Rend l'URL du fichier à `onUploaded`, à
 * charge de l'appelant de la brancher dans le thème (avatar, fond, curseur…).
 */
const ACCEPT: Record<MediaType, string> = {
  AVATAR: "image/jpeg,image/png,image/webp,image/gif",
  BANNER: "image/jpeg,image/png,image/webp,image/gif",
  BACKGROUND: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm",
  AUDIO: "audio/mpeg,audio/ogg,audio/wav",
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

export type UploadedAsset = { id: string; type: MediaType; url: string; key: string };

export function MediaUpload({
  type,
  currentUrl,
  onUploaded,
  onCleared,
}: {
  type: MediaType;
  currentUrl?: string;
  onUploaded: (asset: UploadedAsset) => void;
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

    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("biolinkId", biolink.id);

    // XMLHttpRequest et non fetch : lui seul expose la progression d'upload,
    // ce qui compte pour une vidéo de fond de plusieurs mégaoctets.
    const result = await new Promise<{ ok: boolean; asset?: UploadedAsset; message?: string }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/media/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.ok) resolve({ ok: true, asset: body.data.asset });
          else resolve({ ok: false, message: body.error?.message ?? "Échec de l'upload." });
        } catch {
          resolve({ ok: false, message: "Réponse illisible du serveur." });
        }
      };

      xhr.onerror = () => resolve({ ok: false, message: "Connexion interrompue." });
      xhr.send(form);
    });

    setUploading(false);

    if (!result.ok || !result.asset) {
      setError(result.message ?? "Échec de l'upload.");
      return;
    }

    onUploaded(result.asset);
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
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
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
