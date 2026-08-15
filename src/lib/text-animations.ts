/**
 * Animations de texte disponibles, partagées entre le thème (titre), le bloc
 * en-tête (bio) et les blocs de texte.
 *
 * Une seule source de vérité : les schémas zod du thème et des blocks
 * référencent cette liste, ce qui évite qu'ils divergent — un choix proposé
 * par l'éditeur mais refusé par le schéma serveur, ou l'inverse.
 */
export const TEXT_ANIMATIONS = [
  "none",
  "typewriter",
  "glitch",
  "fade",
  "sparkle",
  "wave",
] as const;

export type TextAnimation = (typeof TEXT_ANIMATIONS)[number];

/** Libellés français pour l'éditeur. */
export const TEXT_ANIMATION_LABELS: Record<TextAnimation, string> = {
  none: "Aucune",
  typewriter: "Machine à écrire",
  glitch: "Glitch",
  fade: "Fondu",
  sparkle: "Scintillement",
  wave: "Vague",
};
