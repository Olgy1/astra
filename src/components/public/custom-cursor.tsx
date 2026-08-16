"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { parseCurFile } from "@/lib/cursor-image";

/**
 * Curseur personnalisé.
 *
 * Rendu par une image qui suit la souris, plutôt que par la propriété CSS
 * `cursor: url(...)` : les navigateurs n'acceptent qu'un sous-ensemble de
 * formats (PNG, CUR, GIF — jamais SVG), avec des limites de taille strictes,
 * et une image refusée fait simplement disparaître le curseur sans explication.
 * En suivant la souris en JavaScript, n'importe quelle image uploadée
 * fonctionne, quel que soit son format.
 *
 * Les fichiers `.cur` / `.ico` (le format natif des curseurs Windows) ne sont
 * pas affichés par tous les navigateurs dans une balise `<img>` : on les
 * décode côté client en PNG (voir cursor-image.ts), et on récupère au passage
 * le point actif déclaré dans le fichier — les curseurs .cur portent leur
 * hotspot, inutile de le régler à la main.
 *
 * La traînée, elle, vit dans son propre composant (sparkle-trail.tsx) : elle
 * peut s'activer même sans curseur personnalisé.
 */

export function CustomCursor({ cursor }: { cursor: ThemeConfig["cursor"] }) {
  const { enabled, url, hotspotX, hotspotY } = cursor;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  // Point actif lu dans le fichier .cur, prioritaire sur les curseurs
  // manuels (un .cur porte déjà son hotspot).
  const [fileHotspot, setFileHotspot] = useState<{ x: number; y: number } | null>(null);
  const cursorRef = useRef<HTMLImageElement>(null);

  // Charge l'image en avance pour savoir si elle est exploitable. Tant qu'elle
  // n'est pas prête, on garde le curseur natif. Les .cur/.ico sont décodés en
  // PNG (les navigateurs ne les affichent pas tous dans une balise <img>).
  useEffect(() => {
    if (!enabled || !url || failed) return;
    // Capture étroite pour le code asynchrone (le narrowing de TypeScript ne
    // traverse pas la fermeture).
    const source = url;

    let cancelled = false;
    const isCur = /\.(cur|ico)(\?|#|$)/i.test(source);

    async function load() {
      try {
        if (isCur) {
          const response = await fetch(source);
          if (!response.ok) throw new Error("fetch failed");
          const parsed = await parseCurFile(await response.arrayBuffer());
          if (cancelled) return;
          if (parsed) {
            setDisplayUrl(parsed.url);
            setFileHotspot({ x: parsed.hotspotX, y: parsed.hotspotY });
            setReady(true);
            return;
          }
          // Fichier .cur/.ico illisible : on retombe sur l'affichage direct
          // (fonctionne pour .ico dans tous les navigateurs, pour .cur dans
          // Firefox). S'il échoue aussi, l'erreur ci-dessous le signale.
        }

        const image = new Image();
        image.onload = () => {
          if (!cancelled) {
            setDisplayUrl(source);
            setReady(true);
          }
        };
        image.onerror = () => {
          if (!cancelled) setFailed(true);
        };
        image.src = source;
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [enabled, url, failed]);

  // Point actif effectif : celui du fichier .cur si on l'a, sinon les réglages.
  const hotX = fileHotspot?.x ?? hotspotX;
  const hotY = fileHotspot?.y ?? hotspotY;

  // Suit la souris. Le positionnement passe par transform, sans toucher au
  // layout. L'animation frame n'est demandée qu'après un déplacement réel :
  // au repos, aucune frame n'est rendue (zéro coût), et tout le budget GPU
  // revient aux canvas d'ambiance. Le curseur suit ainsi sans jamais être
  // retardé par le travail de rendu de la page.
  useEffect(() => {
    if (!enabled || !ready) return;

    let raf = 0;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let pending = false;
    let visible = false;

    function frame() {
      pending = false;
      const cursor = cursorRef.current;
      if (cursor) {
        cursor.style.transform = `translate3d(${mouseX - hotX}px, ${mouseY - hotY}px, 0)`;
        // La première frame rend aussi l'image visible : l'opacité démarre à 0
        // (l'image arrive asynchrone), et un simple `mouseenter` ne suffit pas
        // — il ne se déclenche pas si la souris est déjà dans la fenêtre au
        // chargement.
        if (!visible) {
          cursor.style.opacity = "1";
          visible = true;
        }
      }
    }

    function onMove(event: MouseEvent) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!pending) {
        pending = true;
        raf = requestAnimationFrame(frame);
      }
    }

    // On masque le curseur quand la souris quitte la fenêtre, on le
    // réaffiche quand elle revient — sans attendre le prochain mouvement.
    function onLeave(event: MouseEvent) {
      if (!event.relatedTarget) {
        const cursor = cursorRef.current;
        if (cursor) cursor.style.opacity = "0";
      }
    }
    function onEnter() {
      const cursor = cursorRef.current;
      if (cursor) cursor.style.opacity = "1";
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
    };
  }, [enabled, ready, hotX, hotY]);

  // Masque le curseur natif uniquement quand l'image personnalisée est prête.
  useEffect(() => {
    const root = document.documentElement;
    if (enabled && ready) {
      root.classList.add("astra-cursor-hidden");
      return () => root.classList.remove("astra-cursor-hidden");
    }
  }, [enabled, ready]);

  if (!enabled || !url || failed || !displayUrl) return null;

  return (
    <>
      {ready && (
        <style>{`.astra-cursor-hidden, .astra-cursor-hidden * { cursor: none !important; }`}</style>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={cursorRef}
        src={displayUrl}
        alt=""
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999]"
        style={{
          // Les images de curseur sont petites ; on borne quand même pour ne
          // jamais recouvrir la page.
          maxWidth: "128px",
          maxHeight: "128px",
          width: "auto",
          height: "auto",
          opacity: 0,
          willChange: "transform",
        }}
        draggable={false}
      />
    </>
  );
}
