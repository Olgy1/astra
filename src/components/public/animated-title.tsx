"use client";

import { useEffect, useState } from "react";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { onEntered } from "@/components/public/entered";

type Animation = ThemeConfig["effects"]["titleAnimation"];

/**
 * Animations de titre.
 *
 * Le texte complet est toujours présent dans le DOM, même pendant
 * l'animation : la version animée est purement visuelle et masquée aux
 * lecteurs d'écran. Sinon, « typewriter » ferait annoncer le titre lettre par
 * lettre, et les moteurs de recherche liraient un titre tronqué.
 */
export function AnimatedTitle({
  text,
  animation,
  speed,
}: {
  text: string;
  animation: Animation;
  speed: number;
}) {
  const [visible, setVisible] = useState(animation === "typewriter" ? 0 : text.length);
  const [reduced, setReduced] = useState(false);
  // La machine à écrire ne démarre qu'au signal d'entrée : avec un écran
  // d'entrée, le texte ne doit pas s'écrire pendant que la page est couverte.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    return onEntered(() => setEntered(true));
  }, []);

  useEffect(() => {
    if (animation !== "typewriter" || reduced || !entered) {
      setVisible(animation === "typewriter" ? 0 : text.length);
      return;
    }

    setVisible(0);
    const interval = setInterval(() => {
      setVisible((current) => {
        if (current >= text.length) {
          clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [text, animation, speed, reduced, entered]);

  if (animation === "none" || reduced) return <>{text}</>;

  if (animation === "typewriter") {
    return (
      <>
        <span aria-hidden>
          {text.slice(0, visible)}
          {visible < text.length && (
            <span className="ml-0.5 inline-block w-0.5 animate-pulse bg-current align-middle" style={{ height: "0.9em" }} />
          )}
        </span>
        {/* Le titre complet, lu par les lecteurs d'écran et les robots. */}
        <span className="sr-only">{text}</span>
      </>
    );
  }

  if (animation === "glitch") {
    return (
      <span className="relative inline-block" data-text={text}>
        <span className="relative z-10">{text}</span>
        <span
          aria-hidden
          className="absolute inset-0 animate-[glitch_2.5s_infinite] text-[var(--page-accent)] opacity-70"
          style={{ clipPath: "inset(0 0 50% 0)" }}
        >
          {text}
        </span>
      </span>
    );
  }

  if (animation === "sparkle") {
    return (
      <span className="bg-[linear-gradient(90deg,var(--page-text),var(--page-accent),var(--page-text))] bg-[length:200%_auto] bg-clip-text text-transparent [animation:sparkle_3s_linear_infinite]">
        {text}
      </span>
    );
  }

  if (animation === "wave") {
    return (
      <>
        <span aria-hidden>
          {[...text].map((char, index) => (
            <span
              key={index}
              className="inline-block [animation:wave_1.6s_ease-in-out_infinite]"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Espace insécable : un espace normal dans un inline-block
                  s'effondre et les mots se collent. */}
              {char === " " ? " " : char}
            </span>
          ))}
        </span>
        <span className="sr-only">{text}</span>
      </>
    );
  }

  // fade
  return <span className="[animation:fade-in_1s_ease-out]">{text}</span>;
}
