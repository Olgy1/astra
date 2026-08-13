"use client";

import { useEffect } from "react";
import { onEntered } from "@/components/public/entered";

/**
 * Animation du titre d'onglet (`document.title`) en machine à écrire.
 *
 * Distincte de `AnimatedTitle`, qui anime le titre *à l'intérieur* de la
 * page : l'onglet est un endroit à part (visible même quand la page est
 * couverte), et les deux s'animent de façon indépendante.
 *
 * Comme tout le reste, l'animation n'attend pas : elle démarre au signal
 * d'entrée (immédiat si pas d'écran d'entrée, au clic sinon). Le titre est
 * tapé, maintenu un instant, effacé, puis retapé — en boucle. Seul le titre
 * de la page est animé, jamais de suffixe (« · Astra »).
 *
 * Deux détails qui comptent : le titre n'est **jamais** vide (un onglet au
 * titre vide affiche l'URL du site — on met une espace à la place), et la
 * cadence varie légèrement d'un caractère à l'autre pour un rendu naturel,
 * pas mécanique.
 */
export function TabTitle({
  title,
  enabled,
  speed,
}: {
  title: string;
  enabled: boolean;
  speed: number;
}) {
  useEffect(() => {
    if (!enabled || !title) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.title = title;
      return;
    }

    let cancelled = false;
    let raf = 0;
    // Restaure le titre complet au démontage (navigation, fermeture de
    // l'aperçu…).
    const cleanup = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      document.title = title;
    };

    const off = onEntered(() => {
      const full = title;
      // Une espace de largeur nulle plutôt qu'une chaîne vide : un titre
      // vide fait afficher l'URL du site par le navigateur, mais une simple
      // espace est retirée par le trim du DOM. L'espace zéro-largeur est
      // invisible, conservée telle quelle, et n'est pas « vide » pour le
      // navigateur.
      const blank = "\u200B";
      let pos = 0;
      let nextAt = performance.now() + 300;
      let phase: "typing" | "holding" | "deleting" | "paused" = "typing";
      document.title = blank;

      const tick = (now: number) => {
        if (cancelled) return;
        if (now < nextAt) {
          raf = requestAnimationFrame(tick);
          return;
        }

        if (phase === "typing") {
          pos = Math.min(full.length, pos + 1);
          document.title = full.slice(0, pos) || blank;
          if (pos >= full.length) {
            phase = "holding";
            nextAt = now + 1600;
          } else {
            // Cadence naturelle : chaque caractère tombe à un instant
            // légèrement différent, comme une vraie frappe.
            nextAt = now + speed * (0.8 + Math.random() * 0.4);
          }
        } else if (phase === "holding") {
          phase = "deleting";
          nextAt = now + Math.max(30, speed * 0.55);
        } else if (phase === "deleting") {
          pos = Math.max(0, pos - 1);
          document.title = full.slice(0, pos) || blank;
          if (pos <= 0) {
            phase = "paused";
            nextAt = now + 650;
          } else {
            nextAt = now + Math.max(30, speed * 0.55);
          }
        } else {
          // paused → on retape.
          phase = "typing";
          nextAt = now + 120;
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    });

    return cleanup;
  }, [title, enabled, speed]);

  return null;
}
