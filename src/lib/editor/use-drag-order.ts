"use client";

import { useRef, useState } from "react";

/**
 * Réordonnancement par glisser-déposer, sur l'API HTML5 native.
 *
 * Pas de bibliothèque : le drag-and-drop natif suffit pour une liste
 * verticale, et une dépendance de plus alourdirait le bundle du panel pour un
 * besoin que le navigateur couvre déjà.
 *
 * Le hook ne mute pas la liste : il calcule le nouvel ordre et le remonte via
 * `onReorder`, à charge de l'appelant de persister. Cette séparation permet
 * d'afficher le nouvel ordre immédiatement (optimiste) tout en sauvegardant
 * en tâche de fond.
 */
export function useDragOrder<T extends { id: string }>(
  items: T[],
  onReorder: (ordered: T[]) => void
) {
  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function reorder(from: string, to: string) {
    if (from === to) return;

    const fromIndex = items.findIndex((item) => item.id === from);
    const toIndex = items.findIndex((item) => item.id === to);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
  }

  return {
    /** Élément en cours de survol pendant un glissement, pour l'indicateur visuel. */
    overId,
    handlers(id: string) {
      return {
        draggable: true,
        onDragStart: (event: React.DragEvent) => {
          dragId.current = id;
          event.dataTransfer.effectAllowed = "move";
        },
        onDragOver: (event: React.DragEvent) => {
          // preventDefault est obligatoire pour autoriser le drop : sans lui,
          // le navigateur refuse la cible et onDrop ne se déclenche jamais.
          event.preventDefault();
          if (overId !== id) setOverId(id);
        },
        onDragLeave: () => {
          if (overId === id) setOverId(null);
        },
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          if (dragId.current) reorder(dragId.current, id);
          dragId.current = null;
          setOverId(null);
        },
        onDragEnd: () => {
          dragId.current = null;
          setOverId(null);
        },
      };
    },
  };
}
