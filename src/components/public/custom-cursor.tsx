"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { isLowEndDevice } from "@/components/public/device";

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

/** Forme du logo Astra : étincelle à quatre branches, remplie par la couleur. */
function AstraShape({ size, color }: { size: number; color: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      aria-hidden
      style={{ width: size, height: size, display: "block" }}
    >
      <path
        d="M512 102 Q512 512 922 512 Q512 512 512 922 Q512 512 102 512 Q512 512 512 102 Z"
        fill={color}
      />
    </svg>
  );
}

/** Étoile à cinq branches, dessinée en polygone. */
function StarShape({ size, color }: { size: number; color: string }) {
  const points = Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? 0.5 : 0.22;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${50 + radius * 50 * Math.cos(angle)},${50 + radius * 50 * Math.sin(angle)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" aria-hidden style={{ width: size, height: size, display: "block" }}>
      <polygon points={points} fill={color} />
    </svg>
  );
}

function TrailParticle({
  kind,
  size,
  color,
  rotation,
}: {
  kind: ThemeConfig["cursor"]["trailKind"];
  size: number;
  color: string;
  rotation: number;
}) {
  switch (kind) {
    case "astra":
      return <AstraShape size={size} color={color} />;
    case "stars":
      return <StarShape size={size} color={color} />;
    case "squares":
      return (
        <span
          className="block"
          style={{ width: size, height: size, backgroundColor: color, transform: `rotate(${rotation}deg)` }}
        />
      );
    default:
      return (
        <span className="block rounded-full" style={{ width: size, height: size, backgroundColor: color }} />
      );
  }
}

export function CustomCursor({ cursor }: { cursor: ThemeConfig["cursor"] }) {
  const { enabled, url, hotspotX, hotspotY, trailEnabled, trailColor, trailKind } = cursor;
  // Machine modeste : moitié de la traînée, et le rendu garde huit nœuds (les
  // derniers restent invisibles) pour ne pas casser l'hydratation.
  const trailCount = trailEnabled && isLowEndDevice() ? 4 : 8;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cursorRef = useRef<HTMLImageElement>(null);
  // Les éléments de la traînée vivent dans une ref : le rendu recrée un
  // tableau à chaque passe, et la boucle d'animation (une seule closure) doit
  // retrouver les mêmes nœuds quoi qu'il arrive.
  const trailElsRef = useRef<(HTMLSpanElement | null)[]>([]);

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

  // Suit la souris (avec une traînée optionnelle). Le positionnement passe
  // par transform, sans toucher au layout, et par une seule animation frame.
  useEffect(() => {
    if (!enabled || !ready) return;

    let raf = 0;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let visible = true;
    // Dernier mouvement connu : au-delà d'un court répit, la boucle s'arrête
    // (la traînée est immobile) et ne reprend qu'au prochain mouvement.
    let lastMove = performance.now();
    const TRAIL = trailEnabled ? trailCount : 0;
    // Chaque particule porte sa position, sa taille et une rotation propre,
    // pour que la traînée ne soit pas un simple dégradé de points.
    const trail: { x: number; y: number; size: number; rotation: number }[] = Array.from(
      { length: TRAIL },
      (_, index) => ({
        x: mouseX,
        y: mouseY,
        size: 14 - index * 1.1,
        rotation: index * 18,
      })
    );

    function frame() {
      const cursor = cursorRef.current;
      if (cursor) {
        cursor.style.opacity = visible ? "1" : "0";
        cursor.style.transform = `translate3d(${mouseX - hotspotX}px, ${mouseY - hotspotY}px, 0)`;
      }

      // Chaque particule se rapproche de la précédente : l'ensemble dessine un
      // ruban qui suit la souris avec un retard progressif. La vitesse
      // d'interpolation plus lente vers l'arrière de la file crée un effet de
      // traîne qui s'étire et se resserre naturellement.
      let previousX = mouseX;
      let previousY = mouseY;
      for (let index = 0; index < TRAIL; index++) {
        const point = trail[index];
        // La première particule suit de près, les suivantes avec un retard
        // croissant : c'est ce qui donne l'impression de fluidité.
        const follow = 0.32 - index * 0.02;
        point.x += (previousX - point.x) * follow;
        point.y += (previousY - point.y) * follow;
        point.rotation += 1.6; // rotation lente et continue
        const element = trailElsRef.current[index];
        if (element) {
          element.style.transform = `translate3d(${point.x - point.size / 2}px, ${point.y - point.size / 2}px, 0)`;
          // Opacité décroissante vers la queue, jamais nulle au repos : la
          // traînée reste visible même souris immobile.
          element.style.opacity = visible ? String(0.55 - index * 0.05) : "0";
        }
        previousX = point.x;
        previousY = point.y;
      }

      // Souris au repos : la traînée est figée, rien ne justifie de continuer
      // à peindre soixante images par seconde.
      if (performance.now() - lastMove > 150) {
        raf = 0;
        return;
      }

      raf = requestAnimationFrame(frame);
    }

    function onMove(event: MouseEvent) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      lastMove = performance.now();
      // Boucle arrêtée (repos ou onglet caché) : un mouvement la relance.
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        // Réveil : on reprend comme si la souris venait de bouger.
        lastMove = performance.now();
        raf = requestAnimationFrame(frame);
      }
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
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, ready, trailEnabled, trailCount, hotspotX, hotspotY]);

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
      {trailEnabled && ready && (
        <span aria-hidden className="pointer-events-none fixed left-0 top-0 z-[9998]">
          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={index}
              ref={(element) => {
                trailElsRef.current[index] = element;
              }}
              className="absolute"
              style={{
                width: 14 - index * 1.1,
                height: 14 - index * 1.1,
                // La boucle d'animation ne touche que les premiers nœuds
                // (moitié sur machine modeste) ; les autres restent à 0.
                opacity: 0,
                willChange: "transform",
              }}
            >
              <TrailParticle
                kind={trailKind}
                size={14 - index * 1.1}
                color={trailColor}
                rotation={index * 18}
              />
            </span>
          ))}
        </span>
      )}
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
