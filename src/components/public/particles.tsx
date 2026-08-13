"use client";

import { useEffect, useRef } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { onEntered } from "@/components/public/entered";
import { isLowEndDevice } from "@/components/public/device";

/**
 * Particules d'ambiance (neige, étoiles, bulles, confettis, pluie).
 *
 * Canvas et non des nœuds DOM animés : 200 éléments avec une animation CSS
 * chacun font tomber les téléphones d'entrée de gamme, qui sont la majorité
 * du trafic. Un seul canvas garde le coût constant.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  spin: number;
};

/**
 * Dessine une étoile à cinq branches centrée en (x, y).
 * `outer` est le rayon des pointes, `inner` celui des creux ; `rotation`
 * oriente l'étoile (une branche vers le haut quand elle vaut -π/2).
 */
function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  inner: number,
  rotation: number
) {
  context.beginPath();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / spikes - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
}

export function Particles({ effects }: { effects: ThemeConfig["effects"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { enabled, kind, color, count, speed } = effects.particles;

  useEffect(() => {
    if (!enabled) return;

    // Respecte le réglage système « réduire les animations ». Ce n'est pas
    // une préférence esthétique : ces mouvements déclenchent des malaises
    // chez les personnes sujettes au mal des transports vestibulaire.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Le mouvement ne démarre qu'au signal d'entrée : avec un écran d'entrée,
    // les particules ne bougent pas tant que le visiteur n'a pas cliqué.
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let started = false;

    // Machines modestes : moitié du rendu sur un écran normal, et moins de
    // particules à dessiner à chaque image. Les étoiles (des chemins à dix
    // sommets) sont le cas le plus coûteux, et 200 par image font fondre les
    // processeurs faibles.
    const lowEnd = isLowEndDevice();

    function spawn(): Particle {
      const base = {
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 3,
        opacity: 0.2 + Math.random() * 0.8,
        spin: Math.random() * Math.PI * 2,
      };

      switch (kind) {
        case "snow":
          return { ...base, vx: (Math.random() - 0.5) * 0.3 * speed, vy: (0.3 + Math.random() * 0.5) * speed };
        case "rain":
          return { ...base, size: 1, vx: 0, vy: (4 + Math.random() * 4) * speed };
        case "bubbles":
          return { ...base, size: 2 + Math.random() * 6, vx: (Math.random() - 0.5) * 0.4 * speed, vy: -(0.3 + Math.random() * 0.6) * speed };
        case "confetti":
          return { ...base, size: 2 + Math.random() * 4, vx: (Math.random() - 0.5) * 1.5 * speed, vy: (0.5 + Math.random()) * speed };
        default: // stars : scintillent sur place, un peu plus grandes que les ronds
          return { ...base, size: 1.5 + Math.random() * 3.5, vx: 0, vy: 0 };
      }
    }

    function resize() {
      // devicePixelRatio : sans ça, le canvas est flou sur les écrans
      // retina, qui sont la norme sur mobile. Sur machine modeste, on garde
      // un pixel pour un pixel : la moitié des pixels à peindre.
      const dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    particles = Array.from({ length: lowEnd ? Math.min(count, 60) : count }, spawn);

    function draw() {
      context!.clearRect(0, 0, width, height);
      context!.fillStyle = color;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.spin += 0.02;

        // Réapparition de l'autre côté quand la particule sort du cadre.
        if (p.y > height + 10) { p.y = -10; p.x = Math.random() * width; }
        if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
        if (p.x > width + 10) p.x = -10;
        if (p.x < -10) p.x = width + 10;

        const alpha = kind === "stars"
          ? p.opacity * (0.4 + 0.6 * Math.abs(Math.sin(p.spin)))
          : p.opacity;

        context!.globalAlpha = alpha;

        if (kind === "stars") {
          // Une vraie étoile à cinq branches, qui tourne lentement sur elle-
          // même en scintillant (l'alpha oscille déjà plus haut).
          drawStar(context!, p.x, p.y, p.size, p.size * 0.45, p.spin);
        } else if (kind === "rain") {
          context!.fillRect(p.x, p.y, 1, 8 * speed);
        } else if (kind === "confetti") {
          context!.save();
          context!.translate(p.x, p.y);
          context!.rotate(p.spin);
          context!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          context!.restore();
        } else {
          context!.beginPath();
          context!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          context!.fill();
        }
      }

      context!.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    }

    // Onglet en arrière-plan : plus personne ne regarde, la boucle s'arrête.
    // C'est aussi le poste le plus rentable : un onglet caché qui continue à
    // dessiner 60 images par seconde chauffe la machine pour rien.
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else if (started) {
        draw();
      }
    }

    const off = onEntered(() => {
      started = true;
      draw();
    });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    return () => {
      off();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, [enabled, kind, color, count, speed]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[5] size-full"
    />
  );
}
