"use client";

import { useEffect } from "react";
import { isLowEndDevice } from "@/components/public/device";

/**
 * Adaptation de la qualité sur les machines modestes.
 *
 * Détecte les appareils faibles une fois au montage et :
 *   - pose la classe `astra-low-end` sur <html>, qui déclenche les règles
 *     CSS de public.css (suppression des halos et ombres coûteux à peindre) ;
 *   - plafonne le flou de la carte et celui de l'écran d'entrée en écrivant
 *     directement sur les éléments : un `backdrop-filter` sur toute la carte
 *     (ou tout l'écran) est le poste de dépense le plus lourd sur les GPU
 *     faibles, et le plafond respecte un flou réglé à 0.
 *
 * Le composant ne rend rien : il ne fait que des réglages en bord de page.
 */
export function AdaptiveQuality() {
  useEffect(() => {
    if (!isLowEndDevice()) return;

    const root = document.documentElement;
    root.classList.add("astra-low-end");

    const page = document.querySelector<HTMLElement>(".astra-page");
    const entrance = document.querySelector<HTMLElement>(".astra-entrance-btn");

    // Flou de carte plafonné à 8 px (et jamais ajouté s'il était à 0).
    if (page) {
      const raw = getComputedStyle(page).getPropertyValue("--card-blur").trim();
      const px = parseFloat(raw);
      if (!Number.isNaN(px) && px > 8) {
        page.style.setProperty("--card-blur", "8px");
      }
    }

    // Flou plein écran de l'écran d'entrée plafonné à 4 px.
    if (entrance) {
      const blur = /blur\(([\d.]+)px\)/.exec(getComputedStyle(entrance).backdropFilter);
      if (blur && parseFloat(blur[1]) > 4) {
        entrance.style.backdropFilter = "blur(4px)";
      }
    }

    return () => {
      root.classList.remove("astra-low-end");
      if (page) page.style.removeProperty("--card-blur");
      if (entrance) entrance.style.backdropFilter = "";
    };
  }, []);

  return null;
}
