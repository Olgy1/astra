"use client";

import { useEffect, useRef } from "react";

/**
 * Traînée de particules du curseur.
 *
 * Chaque passage du curseur émet de petites particules lumineuses qui
 * retombent (ou montent, pour les bulles) et s'estompent en une fraction de
 * seconde. Un seul canvas pour toute la traînée.
 *
 * Optimisations de rendu (pour rester fluide sur les machines modestes) :
 *  - chaque forme (croix, étoile, halo, bulle) est pré-dessinée une seule
 *    fois dans un petit canvas hors écran (« sprite »), puis copiée par
 *    `drawImage` à chaque frame — bien moins cher que de retracer les
 *    chemins (arcs, étoiles) pour chaque particule ;
 *  - la boucle d'animation s'ARRÊTE quand il n'y a plus de particule : au
 *    repos, plus aucune frame de canvas plein écran n'est rendue, et tout le
 *    budget GPU revient au reste de la page (curseur compris) ;
 *  - le nombre de particules est plafonné plus bas et le DPR est réduit sur
 *    les très grands écrans.
 *
 * Plusieurs types, tous subtils et dans l'esprit néon de la plateforme :
 *  - `sparkles` : étincelles en croix avec un cœur brillant (effet par défaut) ;
 *  - `stars` : petites étoiles à cinq branches qui retombent en tournant ;
 *  - `snow` : flocons ronds qui tombent lentement en dérivant ;
 *  - `dust` : poussière lumineuse, des points doux qui flottent et s'estompent ;
 *  - `bubbles` : bulles creuses qui remontent.
 *
 * Les valeurs historiques du thème (`circles`, `squares`, `astra`) sont
 * traduites vers ces effets pour ne jamais laisser une page sans traînée.
 */

export type TrailKind = "sparkles" | "stars" | "snow" | "dust" | "bubbles" | "circles" | "squares" | "astra";

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0, la particule meurt à 0
  decay: number;
  size: number;
  spin: number;
  /** Vrai quand la particule porte la couleur secondaire (si définie). */
  alt: boolean;
};

type SpriteKind = Exclude<TrailKind, "circles" | "squares" | "astra">;

/** Traduit les anciens types vers les nouveaux effets. */
function normalizeKind(kind: TrailKind): SpriteKind {
  if (kind === "circles" || kind === "squares") return "dust";
  if (kind === "astra") return "sparkles";
  return kind;
}

/** Étoile à cinq branches centrée en (x, y). */
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

/**
 * Sprite de forme : la particule est dessinée une seule fois dans un petit
 * canvas (rayon 16), puis copiée à chaque frame. `SIZE_FACTOR` remappe le
 * rayon du sprite vers la taille d'origine de la particule (chaque forme a
 * sa propre échelle dans son sprite).
 */
const SPRITE_RADIUS = 16;

const SIZE_FACTOR: Record<SpriteKind, number> = {
  sparkles: 2,
  stars: 2.2,
  snow: 3.6,
  dust: 3.6,
  bubbles: 1.4,
};

/** Seules les étoiles tournent (les autres formes sont symétriques). */
function rotates(kind: SpriteKind): boolean {
  return kind === "stars";
}

function makeSprite(kind: SpriteKind, color: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE_RADIUS * 4; // ×2 pour la netteté sur écrans retina
  sprite.height = SPRITE_RADIUS * 4;
  const g = sprite.getContext("2d")!;
  g.scale(2, 2);
  g.translate(SPRITE_RADIUS, SPRITE_RADIUS);

  switch (kind) {
    case "sparkles": {
      // Croix à quatre branches + cœur brillant.
      g.strokeStyle = color;
      g.lineWidth = 1;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-SPRITE_RADIUS, 0);
      g.lineTo(SPRITE_RADIUS, 0);
      g.moveTo(0, -SPRITE_RADIUS);
      g.lineTo(0, SPRITE_RADIUS);
      g.stroke();
      g.fillStyle = color;
      g.beginPath();
      g.arc(0, 0, SPRITE_RADIUS * 0.35, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "stars": {
      g.fillStyle = color;
      drawStar(g, 0, 0, SPRITE_RADIUS, SPRITE_RADIUS * 0.45, -Math.PI / 2);
      break;
    }
    case "snow":
    case "dust": {
      // Halo doux + cœur : un point de poussière lumineuse.
      g.globalAlpha = 0.25;
      g.fillStyle = color;
      g.beginPath();
      g.arc(0, 0, SPRITE_RADIUS, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(0, 0, SPRITE_RADIUS * 0.3, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "bubbles": {
      // Bulle creuse, contour lumineux.
      g.strokeStyle = color;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, SPRITE_RADIUS, 0, Math.PI * 2);
      g.stroke();
      break;
    }
  }
  return sprite;
}

export function SparkleTrail({ color, color2, kind }: { color: string; color2?: string; kind: TrailKind }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const normalized = normalizeKind(kind);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Deux couleurs = deux sprites pré-rendus ; chaque particule en tire un
    // au hasard à l'émission, pour un mélange vivant (la composition additive
    // « lighter » fond les deux teintes entre elles). Sans couleur secondaire,
    // un seul sprite : comportement identique à avant.
    const useTwoColors = !!color2 && color2 !== color;
    const sprite = makeSprite(normalized, color);
    const spriteAlt = useTwoColors ? makeSprite(normalized, color2!) : sprite;
    let width = 0;
    let height = 0;
    let sparks: Spark[] = [];
    let raf = 0;
    let running = false;
    let lastX = -1;
    let lastY = -1;

    function resize() {
      // DPR plafonné, et abaissé sur les très grands écrans : au-delà, la
      // résolution du canvas coûte cher pour un gain visuel imperceptible.
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth > 1920 ? 1.5 : 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function emit(x: number, y: number) {
      // 1-2 particules par passage (avant : 1-3) : le rendu reste riche mais
      // moins de travail par frame.
      const count = 1 + Math.floor(Math.random() * 2);

      for (let i = 0; i < count; i++) {
        let vy: number;
        let vx: number;
        let size: number;

        switch (normalized) {
          case "snow":
            // Chute lente, dérive douce — un flocon.
            vy = 0.3 + Math.random() * 0.7;
            vx = (Math.random() - 0.5) * 0.8;
            size = 1 + Math.random() * 2.4;
            break;
          case "bubbles":
            // Les bulles remontent.
            vy = -(0.5 + Math.random() * 1);
            vx = (Math.random() - 0.5) * 0.8;
            size = 1.2 + Math.random() * 2.4;
            break;
          case "dust":
            // Poussière : presque immobile, flotte.
            vy = 0.15 + Math.random() * 0.5;
            vx = (Math.random() - 0.5) * 0.6;
            size = 0.8 + Math.random() * 1.8;
            break;
          case "stars":
            vy = 0.4 + Math.random() * 1.1;
            vx = (Math.random() - 0.5) * 1;
            size = 1.4 + Math.random() * 2.6;
            break;
          default: // sparkles
            vy = 0.6 + Math.random() * 1.4;
            vx = (Math.random() - 0.5) * 1.6;
            size = 1.2 + Math.random() * 2.6;
            break;
        }

        sparks.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx,
          vy,
          life: 1,
          decay: 0.016 + Math.random() * 0.028,
          size,
          spin: Math.random() * Math.PI * 2,
          alt: useTwoColors && Math.random() < 0.5,
        });
      }

      // Plafond : on jette les plus vieilles plutôt que d'exploser la mémoire
      // sur un long tracé de souris. 240 suffisent visuellement et limitent
      // le coût par frame sur les machines modestes.
      if (sparks.length > 240) sparks.splice(0, sparks.length - 240);
    }

    function onMove(event: MouseEvent) {
      // N'émettre qu'au déplacement (pas au repos) : la souris immobile ne
      // laisse rien, le curseur au repos est propre.
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (dx * dx + dy * dy < 4) return;
      lastX = event.clientX;
      lastY = event.clientY;
      emit(event.clientX, event.clientY);
      start();
    }

    function start() {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    function frame() {
      // Au repos (aucune particule), la boucle s'arrête : plus aucune frame
      // de canvas plein écran rendue, c'est là que le budget GPU est rendu
      // au reste de la page (curseur compris).
      if (sparks.length === 0) {
        context!.clearRect(0, 0, width, height);
        running = false;
        return;
      }

      context!.clearRect(0, 0, width, height);
      context!.globalCompositeOperation = "lighter"; // addition : lueur néon
      const factor = SIZE_FACTOR[normalized];

      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vx *= 0.98;
        spark.vy *= 0.99;
        spark.spin += 0.06;
        spark.life -= spark.decay;

        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        context!.globalAlpha = Math.min(1, spark.life * 1.2);
        const drawSize = spark.size * factor;
        const sparkSprite = spark.alt ? spriteAlt : sprite;
        if (rotates(normalized)) {
          context!.save();
          context!.translate(spark.x, spark.y);
          context!.rotate(spark.spin);
          context!.drawImage(sparkSprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          context!.restore();
        } else {
          context!.drawImage(sparkSprite, spark.x - drawSize / 2, spark.y - drawSize / 2, drawSize, drawSize);
        }
      }

      context!.globalAlpha = 1;
      context!.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [color, color2, normalized]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9997]"
    />
  );
}
