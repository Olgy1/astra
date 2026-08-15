"use client";

import { useEffect, useRef } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { onEntered } from "@/components/public/entered";

/**
 * Particules d'ambiance (neige, étoiles, bulles, confettis, pluie).
 *
 * Canvas et non des nœuds DOM animés : 200 éléments avec une animation CSS
 * chacun font tomber les téléphones d'entrée de gamme, qui sont la majorité
 * du trafic. Un seul canvas garde le coût constant.
 *
 * Optimisations de rendu :
 *  - les formes coûteuses (étoiles, flocons, bulles) sont pré-dessinées une
 *    seule fois dans un petit canvas hors écran (« sprite ») puis copiées par
 *    `drawImage`, au lieu de retracer les chemins pour chaque particule à
 *    chaque frame ;
 *  - le nombre de particules s'adapte à la machine (cœurs, mémoire, taille
 *    d'écran) : sur un appareil modeste, on en dessine moins, et le rendu
 *    reste fluide ;
 *  - le DPR est réduit sur les très grands écrans.
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

/** Rayon de la forme dans son sprite (le canvas fait le double, pour la netteté). */
const SPRITE_RADIUS = 16;

/**
 * Sprite de forme pour les particules coûteuses à retracer (étoile, flocon,
 * bulle). Dessiné une seule fois, puis copié par `drawImage` à chaque frame.
 */
function makeSprite(kind: string, color: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE_RADIUS * 4;
  sprite.height = SPRITE_RADIUS * 4;
  const g = sprite.getContext("2d")!;
  g.scale(2, 2);
  g.translate(SPRITE_RADIUS, SPRITE_RADIUS);

  if (kind === "stars") {
    g.fillStyle = color;
    drawStar(g, 0, 0, SPRITE_RADIUS, SPRITE_RADIUS * 0.45, -Math.PI / 2);
  } else if (kind === "snow") {
    // Halo doux + cœur.
    g.globalAlpha = 0.25;
    g.fillStyle = color;
    g.beginPath();
    g.arc(0, 0, SPRITE_RADIUS, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(0, 0, SPRITE_RADIUS * 0.3, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "bubbles") {
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, SPRITE_RADIUS, 0, Math.PI * 2);
    g.stroke();
  }
  return sprite;
}

/**
 * Ajuste le nombre de particules demandé à la machine : moins de cœurs, peu
 * de mémoire ou un très grand écran → moins de particules. C'est une vraie
 * optimisation (le rendu reste fluide sur un appareil d'entrée de gamme),
 * pas un simple plafond fixe.
 */
function adaptiveCount(requested: number, width: number, height: number): number {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  let factor = 1;
  if (cores <= 2) factor *= 0.5;
  else if (cores <= 4) factor *= 0.8;
  if (mem <= 2) factor *= 0.6;
  else if (mem <= 4) factor *= 0.85;
  if (width * height > 2_500_000) factor *= 0.75;
  return Math.max(12, Math.round(requested * factor));
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
      // retina, qui sont la norme sur mobile. Réduit sur les très grands
      // écrans, où la résolution coûte cher pour un gain imperceptible.
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, width > 1920 ? 1.5 : 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    const sprite = makeSprite(kind, color);
    particles = Array.from({ length: adaptiveCount(count, width, height) }, spawn);

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
          // Une vraie étoile à cinq branches, copiée depuis le sprite, qui
          // tourne lentement sur elle-même en scintillant.
          context!.save();
          context!.translate(p.x, p.y);
          context!.rotate(p.spin);
          context!.drawImage(sprite, -p.size, -p.size, p.size * 2, p.size * 2);
          context!.restore();
        } else if (kind === "snow") {
          // Flocon : halo + cœur, un seul drawImage.
          const w = p.size * 3.6;
          context!.drawImage(sprite, p.x - w / 2, p.y - w / 2, w, w);
        } else if (kind === "bubbles") {
          // Bulle creuse, un seul drawImage.
          const w = p.size * 1.4;
          context!.drawImage(sprite, p.x - w / 2, p.y - w / 2, w, w);
        } else if (kind === "rain") {
          // Pluie : un simple rectangle, déjà bon marché.
          context!.fillRect(p.x, p.y, 1, 8 * speed);
        } else {
          // Confettis : un rectangle pivoté, déjà bon marché.
          context!.save();
          context!.translate(p.x, p.y);
          context!.rotate(p.spin);
          context!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          context!.restore();
        }
      }

      context!.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    }

    const off = onEntered(() => {
      draw();
    });
    window.addEventListener("resize", resize);

    return () => {
      off();
      cancelAnimationFrame(frame);
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
