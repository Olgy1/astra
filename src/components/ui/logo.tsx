import type { SVGProps } from "react";

/**
 * Étoile Astra, reprise de `astralauncher/assets/icon.svg`.
 *
 * Le tracé est identique à l'original ; seul le remplissage change : le
 * dégradé violet devient `currentColor`, si bien que l'icône prend la couleur
 * du texte qui l'entoure. Un seul composant sert donc partout — blanc dans
 * l'en-tête, violet sur fond clair, gris quand il est désactivé — sans avoir
 * à maintenir un fichier par teinte.
 *
 * Inline plutôt qu'un `<img src="/icon.svg">` : pas de requête réseau, pas de
 * clignotement au chargement, et la couleur reste pilotable en CSS — ce
 * qu'un PNG ne permet pas.
 */
export function Logo({
  title,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      // Sans titre, l'icône est décorative : on la masque aux lecteurs
      // d'écran plutôt que de leur faire annoncer un graphique sans nom.
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title && <title>{title}</title>}
      <path d="M512 102 Q512 512 922 512 Q512 512 512 922 Q512 512 102 512 Q512 512 512 102 Z" />
    </svg>
  );
}

/**
 * Étoile + nom, tels qu'ils apparaissent dans l'en-tête et sur les écrans
 * d'authentification.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Logo className="size-[1.1em]" />
      <span className="font-semibold tracking-tight">astra</span>
    </span>
  );
}
