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
 * Le dédoublonnage sur 24 h (même visiteur) est fait côté serveur : ici on se
 * contente de ne pas appeler deux fois pour un même montage, ce que le mode
 * strict de React provoquerait en développement.
 */
/**
 * Identifiant stable du navigateur, pour le comptage des vues uniques.
 *
 * Généré une fois et conservé en localStorage : c'est lui qui permet au
 * serveur de reconnaître le même navigateur d'une visite à l'autre, sans
 * cookie ni empreinte de machine. Un identifiant aléatoire n'est pas une
 * donnée personnelle — il ne désigne que ce navigateur, pas une personne.
 */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem("astra:visitor");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("astra:visitor", id);
    }
    return id;
  } catch {
    // localStorage indisponible (navigation privée restreinte, ancien
    // navigateur) : on ne peut pas dédoublonner, la vue comptera comme
    // non-unique plutôt que de ne pas compter du tout.
    return "";
  }
}

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
      body: JSON.stringify({ referrer, visitorId: getVisitorId() }),
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
