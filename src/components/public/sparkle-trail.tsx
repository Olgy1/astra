"use client";

import { useEffect, useRef } from "react";

/**
 * Traînée de particules du curseur.
 *
 * Chaque passage du curseur émet de petites particules lumineuses qui
 * retombent (ou montent, pour les bulles) et s'estompent en une fraction de
 * seconde. Un seul canvas pour toute la traînée : une centaine de particules
 * par seconde ne coûte rien, là où des nœuds DOM animés s'empileraient.
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
};

/** Traduit les anciens types vers les nouveaux effets. */
function normalizeKind(kind: TrailKind): Exclude<TrailKind, "circles" | "squares" | "astra"> {
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

export function SparkleTrail({ color, kind }: { color: string; kind: TrailKind }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const normalized = normalizeKind(kind);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let sparks: Spark[] = [];
    let raf = 0;
    let lastX = -1;
    let lastY = -1;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function emit(x: number, y: number) {
      const count = 1 + Math.floor(Math.random() * 3);

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
        });
      }

      // Plafond : on jette les plus vieilles plutôt que d'exploser la mémoire
      // sur un long tracé de souris.
      if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
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
    }

    function drawParticle(spark: Spark, alpha: number) {
      const s = spark.size;

      switch (normalized) {
        case "stars": {
          // La couleur n'est pas héritée par `drawStar` (qui ne fait que
          // `fill()` avec le fillStyle courant) : sans cette ligne, l'étoile
          // resterait noire — le défaut du canvas — au lieu de prendre la
          // couleur de traînée choisie dans le thème.
          context!.fillStyle = color;
          drawStar(context!, spark.x, spark.y, s, s * 0.45, spark.spin);
          break;
        }
        case "snow":
        case "dust": {
          // Halo doux + cœur : un point de poussière lumineuse.
          context!.beginPath();
          context!.arc(spark.x, spark.y, s * 1.8, 0, Math.PI * 2);
          context!.fillStyle = color;
          context!.globalAlpha = alpha * 0.25;
          context!.fill();
          context!.beginPath();
          context!.arc(spark.x, spark.y, s * 0.55, 0, Math.PI * 2);
          context!.globalAlpha = alpha;
          context!.fill();
          break;
        }
        case "bubbles": {
          // Bulle creuse, contour lumineux.
          context!.beginPath();
          context!.arc(spark.x, spark.y, s * 0.7, 0, Math.PI * 2);
          context!.strokeStyle = color;
          context!.lineWidth = 1;
          context!.globalAlpha = alpha;
          context!.stroke();
          break;
        }
        default: {
          // sparkles : croix à quatre branches + cœur brillant.
          context!.strokeStyle = color;
          context!.lineWidth = 1;
          context!.globalAlpha = alpha;
          context!.beginPath();
          context!.moveTo(spark.x - s, spark.y);
          context!.lineTo(spark.x + s, spark.y);
          context!.moveTo(spark.x, spark.y - s);
          context!.lineTo(spark.x, spark.y + s);
          context!.stroke();
          context!.beginPath();
          context!.arc(spark.x, spark.y, s * 0.35, 0, Math.PI * 2);
          context!.fillStyle = color;
          context!.fill();
          break;
        }
      }
    }

    function frame() {
      context!.clearRect(0, 0, width, height);
      context!.globalCompositeOperation = "lighter"; // addition : lueur néon

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

        drawParticle(spark, Math.min(1, spark.life * 1.2));
      }

      context!.globalAlpha = 1;
      context!.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [color, normalized]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9997]"
    />
  );
}
