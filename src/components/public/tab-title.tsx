"use client";

import { useEffect } from "react";
import { onEntered } from "@/components/public/entered";

/**
 * Animation du titre d'onglet (`document.title`).
 *
 * Distincte de `AnimatedText`, qui anime le texte *à l'intérieur* de la
 * page : l'onglet est un endroit à part (visible même quand la page est
 * couverte), et les deux s'animent de façon indépendante.
 *
 * Deux styles :
 *  - `typewriter` : le titre est tapé, maintenu, effacé, retapé — en boucle.
 *  - `marquee` : défilement horizontal continu et **sans coupure** — le
 *    texte boucle sur lui-même (BONJOUR → ONJOUR B → NJOUR BO → …), dans le
 *    sens choisi (gauche par défaut). Le mouvement est parfaitement
 *    continu : la copie suivante arrive exactement là où la précédente
 *    sort, le titre n'est jamais vide ni ne saute.
 *
 * Comme tout le reste, l'animation démarre au signal d'entrée (immédiat si
 * pas d'écran d'entrée, au clic sinon). Seul le titre de la page est animé,
 * jamais de suffixe (« · Astra »).
 *
 * Deux détails qui comptent : le titre n'est **jamais** vide (un onglet au
 * titre vide affiche l'URL du site — on met une espace à la place), et la
 * cadence varie légèrement d'un caractère à l'autre pour un rendu naturel,
 * pas mécanique.
 */
export function TabTitle({
  title,
  enabled,
  style,
  speed,
  direction = "left",
}: {
  title: string;
  enabled: boolean;
  style: "typewriter" | "marquee";
  speed: number;
  direction?: "left" | "right";
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

      if (style === "marquee") {
        // Défilement continu, façon bandeau : le titre est dupliqué côte à
        // côte (« Coucou Coucou Coucou… ») et une fenêtre glisse dessus,
        // caractère par caractère. Une répétition = titre + une espace
        // insécable ; la fenêtre avance d'un caractère à la fois sur un cycle
        // de longueur exactement égale à une répétition : quand une copie
        // sort, la suivante entre à sa place. Aucun blanc, aucun saut, le
        // titre n'est jamais vide.
        // NB : « document.title » trime les espaces classiques en début/fin,
        // ce qui ferait disparaître la séparation entre copies — l'espace
        // insécable (\u00A0) n'est pas trimmée, elle reste visible partout.
        const repetition = full + "\u00A0"; // « Coucou » + une espace insécable
        // La fenêtre affichée = vingt répétitions : assez longue pour remplir
        // complètement la barre d'onglet (le navigateur n'affiche que ce qui
        // tient, et ce qui déborde défile).
        const windowCopies = 20;
        const windowLength = repetition.length * windowCopies;
        // La source est un peu plus longue que la fenêtre pour que slice()
        // ne déborde jamais, quel que soit le sens de défilement.
        const source = repetition.repeat(windowCopies + 4);
        // La vitesse est directement en millisecondes par caractère :
        // 1 ms = défilement le plus rapide possible, 300 ms = très lent.
        const period = Math.max(1, speed); // durée par caractère
        let offset = 0;
        let nextAt = performance.now();

        const scroll = (now: number) => {
          if (cancelled) return;
          if (now < nextAt) {
            raf = requestAnimationFrame(scroll);
            return;
          }
          offset = (offset + 1) % repetition.length;
          // « gauche » : la fenêtre avance dans la source (le texte sort par
          // la gauche). « droite » : elle recule (le texte sort par la droite).
          const shift = direction === "right" ? repetition.length - offset : offset;
          document.title = source.slice(shift, shift + windowLength);
          nextAt = now + period;
          raf = requestAnimationFrame(scroll);
        };

        // Première image au décalage 0 du sens choisi : la barre est déjà
        // pleine dès le départ, pas de saut initial.
        const firstShift = direction === "right" ? repetition.length : 0;
        document.title = source.slice(firstShift, firstShift + windowLength);
        raf = requestAnimationFrame(scroll);
        return;
      }

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
          nextAt = now + Math.max(1, speed * 0.55);
        } else if (phase === "deleting") {
          pos = Math.max(0, pos - 1);
          document.title = full.slice(0, pos) || blank;
          if (pos <= 0) {
            phase = "paused";
            nextAt = now + 650;
          } else {
            nextAt = now + Math.max(1, speed * 0.55);
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
  }, [title, enabled, style, speed, direction]);

  return null;
}
