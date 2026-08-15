"use client";

/**
 * Signal « le visiteur est entré ».
 *
 * Une seule source de vérité pour le moment où la page devient visible :
 *   - sans écran d'entrée, il est émis au montage (tout se lance à
 *     l'ouverture) ;
 *   - avec un écran d'entrée, il est émis au clic (tout se lance après).
 *
 * C'est un module, pas un événement window : un composant qui se monte après
 * l'émission (changement de type d'arrière-plan dans l'aperçu, par exemple)
 * doit quand même pouvoir démarrer. `onEntered` exécute immédiatement le
 * callback si le signal a déjà été donné.
 */

const listeners = new Set<() => void>();
let fired = false;

export function signalEntered(): void {
  if (fired) return;
  fired = true;
  for (const listener of listeners) listener();
}

/**
 * Remet le signal à zéro.
 *
 * Utilisé en quittant la page de signalement : la page bio rechargée doit se
 * comporter comme une première visite (écran d'entrée, vidéo depuis le début)
 * plutôt que de reprendre le signal déjà émis par la session précédente.
 */
export function resetEntered(): void {
  fired = false;
}

/** S'abonne au signal. Si le signal a déjà été donné, exécute immédiatement. */
export function onEntered(listener: () => void): () => void {
  if (fired) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
