"use client";

import { useEffect, useRef } from "react";

/**
 * Enregistre une vue, une seule fois par chargement.
 *
 * Composant client sans rendu : le comptage doit se faire depuis le
 * navigateur, pas au rendu serveur. Sinon un préchargement de lien, un robot
 * d'indexation ou un aperçu de partage gonflerait le compteur sans qu'un
 * humain ait vu la page.
 *
 * Le dédoublonnage sur 24 h (même adresse IP) est fait côté serveur : ici on
 * se contente de ne pas appeler deux fois pour un même montage, ce que le mode
 * strict de React provoquerait en développement.
 */
export function ViewTracker({ slug }: { slug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    // referrer envoyé pour l'analytics de provenance. Vidé s'il pointe vers
    // notre propre domaine (navigation interne) : ça ne renseigne en rien.
    let referrer = "";
    try {
      if (document.referrer && new URL(document.referrer).host !== location.host) {
        referrer = new URL(document.referrer).host;
      }
    } catch {
      /* referrer illisible : on n'envoie rien */
    }

    fetch(`/api/public/${slug}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer }),
      keepalive: true,
    })
      .then((response) => response.json().catch(() => null))
      .then((json) => {
        // La réponse porte les compteurs après incrément : on les redistribue
        // au compteur de visites de la page pour une mise à jour en direct.
        const data = json?.data;
        if (json?.ok && typeof data?.totalViews === "number") {
          window.dispatchEvent(
            new CustomEvent("astra:views", {
              detail: { totalViews: data.totalViews, uniqueViews: data.uniqueViews },
            })
          );
        }
      })
      .catch(() => {
        // Un comptage raté n'a aucune conséquence visible : on n'alerte pas.
      });
  }, [slug]);

  return null;
}
