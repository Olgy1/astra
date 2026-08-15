"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  /** Messages d'erreur renvoyés par l'API pour ce champ. */
  errors?: string[];
  hint?: string;
  /** Préfixe non éditable collé au champ, ex: « astraa.is-cool.dev/ ». */
  prefix?: string;
};

export function Input({
  label,
  errors,
  hint,
  prefix,
  id,
  type = "text",
  className = "",
  ...props
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const hasError = Boolean(errors?.length);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-content-secondary">
        {label}
      </label>

      {/*
        Un seul indicateur de focus : la bordure du conteneur, qui passe du
        gris au violet d'accent.

        Deux pièges déjà rencontrés ici, à ne pas réintroduire :
          - l'input porte `outline-none`, sinon la règle `:focus-visible`
            globale lui dessine un contour rectangulaire par-dessus cette
            bordure arrondie ;
          - pas de `ring` non plus. Le halo se dessine à l'extérieur de la
            bordure, qui reste visible : on obtient deux contours
            concentriques au lieu d'un.

        Le passage gris → violet est un changement de contraste franc, il
        suffit à signaler le focus au clavier sans second trait.
      */}
      <div
        className={[
          "flex items-center rounded-xl border bg-surface-1 transition-colors",
          hasError ? "border-danger" : "border-border-subtle focus-within:border-accent",
        ].join(" ")}
      >
        {prefix && (
          <span className="shrink-0 select-none whitespace-nowrap pl-3.5 text-sm text-content-muted">
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          type={isPassword && revealed ? "text" : type}
          // Le lecteur d'écran annonce l'erreur au focus, au lieu de laisser
          // l'utilisateur découvrir un champ rouge qu'il ne peut pas voir.
          aria-invalid={hasError || undefined}
          aria-describedby={
            [hasError ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
            undefined
          }
          className={[
            "w-full min-w-0 bg-transparent px-3.5 py-2.5 text-sm",
            // Neutralise la règle `:focus-visible` de `@layer base`, qui
            // dessinerait un contour rectangulaire par-dessus la bordure
            // arrondie du conteneur. Ça ne fonctionne que parce que cette
            // règle est dans une couche : hors couche, elle l'emporterait sur
            // cet utilitaire quelle que soit la spécificité. Voir globals.css.
            "outline-none focus-visible:outline-none",
            "placeholder:text-content-muted",
            prefix ? "pl-1" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            // tabIndex -1 : la tabulation depuis le champ doit aller au champ
            // suivant, pas à ce bouton d'appoint.
            tabIndex={-1}
            aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="px-3.5 text-xs text-content-muted transition-colors hover:text-content-secondary"
          >
            {revealed ? "Masquer" : "Afficher"}
          </button>
        )}
      </div>

      {hint && !hasError && (
        <p id={hintId} className="text-xs text-content-muted">
          {hint}
        </p>
      )}

      {hasError && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}
