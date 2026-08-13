"use client";

/**
 * État du son voulu par le visiteur, partagé entre le contrôle de volume et
 * les sources (musique d'ambiance, vidéo de fond).
 *
 * Le mutage ne doit pas être qu'une propriété DOM jetable : quand l'onglet
 * revient au premier plan, la vidéo de fond redémarre et réinitialisait son
 * `muted` — le son revenait alors que l'icône affichait toujours « coupé ».
 * C'est ce module qui fait foi ; les sources le consultent à chaque
 * (re)départ pour ne jamais relancer du son que le visiteur a coupé.
 */

let userMuted = false;

/** Le visiteur a-t-il coupé le son (via le contrôle de volume) ? */
export function getSoundMuted(): boolean {
  return userMuted;
}

/** Enregistre le choix du visiteur. */
export function setSoundMuted(next: boolean): void {
  userMuted = next;
}
