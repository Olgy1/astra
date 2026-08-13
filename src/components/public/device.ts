"use client";

/**
 * Détection d'appareil modeste, pour l'adaptation de la qualité.
 *
 * Les effets lourds (flou d'arrière-plan, ombres, particules, traînée du
 * curseur) sont plafonnés sur les machines faibles : un rendu un peu plus
 * plat vaut mieux qu'une page qui saccade.
 *
 * Heuristique volontairement conservatrice — deux cœurs ou 2 Go de RAM sont
 * un très bon indicateur de machine d'entrée de gamme. Sans signal, on
 * retombe sur la qualité pleine plutôt que de dégrader l'expérience de tous.
 */

let cached: boolean | null = null;

export function isLowEndDevice(): boolean {
  if (cached !== null) return cached;

  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    // hardwareConcurrency et deviceMemory sont absents sur certains
    // navigateurs et pendant le rendu serveur : on retombe sur des valeurs
    // moyennes, qui ne déclenchent pas l'adaptation.
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 8;
    cached = cores <= 2 || memory <= 2;
  } catch {
    cached = false;
  }

  return cached;
}
