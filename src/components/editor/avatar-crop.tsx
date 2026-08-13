"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/client-upload";

/**
 * Recadrage de l'avatar.
 *
 * Un carré visible de 264 px sur l'image, qu'on déplace et qu'on zoome
 * (1× à 4×). À l'application, la zone visible est réellement découpée en
 * pixels (canvas) puis ré-uploadée : ce n'est pas un simple zoom CSS, l'image
 * finale ne contient plus que le carré choisi, recadré en 512×512.
 *
 * L'image source est récupérée en blob pour éviter de contaminer le canvas
 * (une image cross-origin le rendrait illisible).
 */

const VIEWPORT = 264;
const OUTPUT = 512;

export function AvatarCropModal({
  imageUrl,
  onClose,
  onApplied,
}: {
  imageUrl: string;
  onClose: () => void;
  onApplied: (asset: { id: string; type: string; url: string; key: string }) => void;
}) {
  const { biolink } = useEditor();

  // Le masque suit la forme d'avatar du thème : le recadrage prévisualise
  // exactement ce que la page réelle affichera (rond, arrondi ou carré).
  const shape = biolink.theme.avatar.shape;
  const viewportRadius =
    shape === "circle" ? "50%" : shape === "rounded" ? "16px" : "0px";
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Charge l'image. Le zoom initial couvre au moins le carré de recadrage.
  useEffect(() => {
    let active = true;

    fetch(imageUrl)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("image illisible"));
            img.src = URL.createObjectURL(blob);
          })
      )
      .then((img) => {
        if (!active) return;
        setImage(img);
        setZoom(Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight));
      })
      .catch(() => {
        if (active) setError("Impossible de charger l'image.");
      });

    return () => {
      active = false;
    };
  }, [imageUrl]);

  if (!image) {
    return (
      <Overlay onClose={onClose}>
        <div className="flex h-64 w-[19rem] flex-col items-center justify-center gap-3">
          <span
            role="status"
            aria-label="Chargement"
            className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </Overlay>
    );
  }

  // Le zoom doit toujours permettre de revenir à la taille « pleine image »,
  // même si elle dépasse le maximum habituel de 4×.
  const fitZoom = Math.max(VIEWPORT / image.naturalWidth, VIEWPORT / image.naturalHeight);
  const zoomMax = Math.max(4, Math.ceil(fitZoom));

  /** Borne le déplacement pour que le carré visible reste dans l'image. */
  function clampOffset(x: number, y: number) {
    const img = image;
    if (!img) return { x: 0, y: 0 };
    const scaledW = img.naturalWidth * zoom;
    const scaledH = img.naturalHeight * zoom;
    const maxX = Math.max(0, (scaledW - VIEWPORT) / 2);
    const maxY = Math.max(0, (scaledH - VIEWPORT) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }

  function onPointerDown(event: React.PointerEvent) {
    if (saving) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDrag({ startX: event.clientX, startY: event.clientY, ox: offset.x, oy: offset.y });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag) return;
    setOffset(clampOffset(drag.ox + (event.clientX - drag.startX), drag.oy + (event.clientY - drag.startY)));
  }

  function onPointerUp() {
    setDrag(null);
  }

  async function apply() {
    const img = image;
    if (!img) return;
    setSaving(true);
    setError(null);

    try {
      // Zone visible en coordonnées de l'image source (relatives au centre).
      const half = VIEWPORT / 2;
      // Le carré ne peut pas dépasser l'image : si le zoom descend sous la
      // taille « pleine image », on prend toute l'image.
      const side = Math.min(VIEWPORT / zoom, img.naturalWidth, img.naturalHeight);
      const centerX = img.naturalWidth / 2 + -(half + offset.x) / zoom;
      const centerY = img.naturalHeight / 2 + -(half + offset.y) / zoom;
      // Le carré reste dans les bornes de l'image, quoi qu'il arrive.
      const sx = Math.max(side / 2, Math.min(img.naturalWidth - side / 2, centerX));
      const sy = Math.max(side / 2, Math.min(img.naturalHeight - side / 2, centerY));

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas indisponible");
      context.imageSmoothingQuality = "high";
      context.drawImage(img, sx - side / 2, sy - side / 2, side, side, 0, 0, OUTPUT, OUTPUT);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("génération impossible");

      const result = await uploadFile({
        file: new File([blob], "avatar.png", { type: "image/png" }),
        type: "AVATAR",
        biolinkId: biolink.id,
      });
      if (!result.ok) throw new Error(result.message);

      onApplied(result.asset);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Échec du recadrage.");
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex w-[19rem] flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Rogner l&apos;avatar</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-content-muted transition-colors hover:text-content-primary"
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>

        {/* La zone visible (dans la forme d'avatar du thème) : déplacez
            l'image, zoomez avec le curseur. */}
        <div
          ref={viewportRef}
          className="relative touch-none overflow-hidden bg-black/30 ring-1 ring-white/25"
          style={{ width: VIEWPORT, height: VIEWPORT, borderRadius: viewportRadius }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
              cursor: saving ? "default" : "grab",
            }}
          />
        </div>

        <label className="flex items-center gap-3 text-xs text-content-secondary">
          <span className="shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={zoomMax}
            step={0.05}
            value={Math.min(zoom, zoomMax)}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--color-accent)]"
          />
          <span className="w-8 shrink-0 text-right tabular-nums text-content-muted">{zoom.toFixed(1)}×</span>
        </label>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving} fullWidth>
            Annuler
          </Button>
          <Button size="sm" loading={saving} onClick={apply} fullWidth>
            Appliquer
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      {/* onClick stopPropagation sur le panneau : cliquer dedans ne ferme pas. */}
      <div
        className="rounded-2xl border border-border-subtle bg-surface-1 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
