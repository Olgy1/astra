"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { SparkleTrail } from "@/components/public/sparkle-trail";

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
 * La traînée est un ruban de particules qui suit le curseur avec un retard :
 * chaque particule se rapproche de la précédente par interpolation, ce qui
 * produit une courbe lisse (et non des points qui se téléportent). Quatre
 * formes possibles : ronds, étoiles, carrés, et le logo Astra — chaque
 * particule tourne doucement et s'estompe en s'éloignant du curseur.
 */

export function CustomCursor({ cursor }: { cursor: ThemeConfig["cursor"] }) {
  const { enabled, url, hotspotX, hotspotY, trailEnabled, trailColor, trailKind } = cursor;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cursorRef = useRef<HTMLImageElement>(null);

  // Charge l'image en avance pour savoir si elle est exploitable. Tant qu'elle
  // n'est pas prête, on garde le curseur natif.
  useEffect(() => {
    if (!enabled || !url || failed) return;

    const image = new Image();
    image.onload = () => setReady(true);
    image.onerror = () => setFailed(true);
    image.src = url;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [enabled, url, failed]);

  // Suit la souris. Le positionnement passe par transform, sans toucher au
  // layout, et par une seule animation frame.
  useEffect(() => {
    if (!enabled || !ready) return;

    let raf = 0;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let visible = true;

    function frame() {
      const cursor = cursorRef.current;
      if (cursor) {
        cursor.style.opacity = visible ? "1" : "0";
        cursor.style.transform = `translate3d(${mouseX - hotspotX}px, ${mouseY - hotspotY}px, 0)`;
      }
      raf = requestAnimationFrame(frame);
    }

    function onMove(event: MouseEvent) {
      mouseX = event.clientX;
      mouseY = event.clientY;
    }

    // On masque le curseur quand la souris quitte la fenêtre.
    function onLeave(event: MouseEvent) {
      if (!event.relatedTarget) visible = false;
    }
    function onEnter() {
      visible = true;
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
    };
  }, [enabled, ready, hotspotX, hotspotY]);

  // Masque le curseur natif uniquement quand l'image personnalisée est prête.
  useEffect(() => {
    const root = document.documentElement;
    if (enabled && ready) {
      root.classList.add("astra-cursor-hidden");
      return () => root.classList.remove("astra-cursor-hidden");
    }
  }, [enabled, ready]);

  if (!enabled || !url || failed) return null;

  return (
    <>
      {ready && (
        <style>{`.astra-cursor-hidden, .astra-cursor-hidden * { cursor: none !important; }`}</style>
      )}
      {trailEnabled && ready && <SparkleTrail color={trailColor} kind={trailKind} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={cursorRef}
        src={url}
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
