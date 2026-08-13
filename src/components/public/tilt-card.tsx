"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Effet 3D au survol : la carte s'incline vers le curseur.
 *
 * Désactivé au toucher — il n'y a pas de survol sur mobile, et l'appliquer au
 * tap ferait sauter la carte sous le doigt.
 */
export function TiltCard({
  enabled,
  intensity,
  children,
}: {
  enabled: boolean;
  intensity: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  // La position de la carte est mise en cache : `getBoundingClientRect` à
  // chaque mousemove force un recalcul de layout à la fréquence de la souris
  // (souvent plus de 120 Hz), ce qui fait saccader les machines faibles. Le
  // cache n'est invalidé que si la page bouge (scroll) ou redimensionne.
  const rect = useRef<DOMRect | null>(null);

  function invalidate() {
    rect.current = null;
  }

  useEffect(() => {
    window.addEventListener("resize", invalidate, { passive: true });
    window.addEventListener("scroll", invalidate, { passive: true });
    return () => {
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("scroll", invalidate);
    };
  }, []);

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!enabled) return;

    const element = ref.current;
    if (!element) return;

    // requestAnimationFrame : mousemove peut tirer plus vite que le taux de
    // rafraîchissement, et écrire le style à chaque événement provoque des
    // recalculs de layout inutiles.
    if (frame.current !== null) cancelAnimationFrame(frame.current);

    if (!rect.current) rect.current = element.getBoundingClientRect();
    const bounds = rect.current;
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    frame.current = requestAnimationFrame(() => {
      element.style.transform = `perspective(1000px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg)`;
    });
  }

  function handleLeave() {
    if (!enabled) return;
    const element = ref.current;
    if (element) element.style.transform = "";
  }

  return (
    <div
      ref={ref}
      onMouseMove={enabled ? handleMove : undefined}
      onMouseLeave={enabled ? handleLeave : undefined}
      className={enabled ? "transition-transform duration-200 ease-out will-change-transform" : undefined}
      // touch-action auto : l'effet ne doit pas capturer le défilement tactile.
      style={enabled ? { touchAction: "auto" } : undefined}
    >
      {children}
    </div>
  );
}
