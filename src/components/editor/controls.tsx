"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Primitives de réglage de l'éditeur.
 *
 * Contrôlées, sans état interne : la valeur vient toujours du store, et
 * `onChange` la remonte. C'est ce qui garantit que l'aperçu reflète l'état et
 * non une copie locale qui divergerait.
 */

export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  // Le sélecteur natif ne gère pas l'alpha (#rrggbbaa). On le tronque à 6
  // chiffres pour lui, tout en laissant le champ texte accepter la version
  // complète — sinon régler une transparence serait impossible.
  const hex6 = value.length > 7 ? value.slice(0, 7) : value;

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-content-secondary">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-24 rounded-lg border border-border-subtle bg-surface-1 px-2 py-1 text-xs outline-none focus:border-accent"
          aria-label={`${label} (code hexadécimal)`}
        />
        <input
          id={id}
          type="color"
          value={hex6}
          onChange={(event) => onChange(event.target.value)}
          className="size-8 cursor-pointer rounded-lg border border-border-subtle bg-transparent"
        />
      </div>
    </div>
  );
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm text-content-secondary">
          {label}
        </label>
        <span className="text-xs tabular-nums text-content-muted">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        // Le rendu est entièrement custom (pseudo-éléments dans globals.css) :
        // le thumb par défaut du navigateur est plus grand que la piste et se
        // fait rogner quand on donne une petite hauteur au slider. En passant
        // par une classe dédiée, tous les sliders de l'éditeur partagent le
        // même thumb entier, centré, à la couleur d'accent.
        className="slider-control w-full cursor-pointer"
      />
    </div>
  );
}

export function ToggleControl({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <label htmlFor={id} className="text-sm text-content-secondary">
          {label}
        </label>
        {description && <p className="text-xs text-content-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        // p-0 : retire le padding par défaut du <button> imposé par le
        // navigateur, sinon il décale la position de base du pouce.
        className={[
          "relative h-6 w-11 shrink-0 rounded-full p-0 transition-colors",
          checked ? "bg-accent" : "bg-surface-3",
        ].join(" ")}
      >
        <span
          // `left-0.5` fixe la base du pouce au bord gauche de la piste, quel
          // que soit le padding du bouton. Il ne se déplace ensuite que de sa
          // propre course : 0 (gauche) → 20px (droite), soit exactement
          // 44 (piste) − 20 (pouce) − 2×2 (marges) = 20px. Impossible de
          // déborder.
          className={[
            "absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Pile de polices CSS : affiche le libellé dans sa propre police (aperçu). */
  fontStack?: string;
};

type MenuPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

/**
 * Sélecteur déroulant commun à tout l'éditeur.
 *
 * Il remplace les `<select>` natifs : ceux-ci ne peuvent pas afficher chaque
 * option dans sa propre police (nécessaire pour l'aperçu des polices), et leur
 * rendu varie d'un navigateur à l'autre. Le menu est porté dans `<body>` via
 * un portail pour ne jamais être rogné par le panneau scrollable de l'éditeur.
 */
export function SelectControl<T extends string>({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  className,
  menuWidth = 240,
  credit,
}: {
  /** Libellé affiché à gauche. Omettre pour un sélecteur « nu » (en ligne). */
  label?: string;
  /** Nom accessible du bouton quand `label` est absent. */
  ariaLabel?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** Classes du bouton déclencheur (largeur, etc.). Défaut : w-40. */
  className?: string;
  /** Largeur du menu déroulant (px). */
  menuWidth?: number;
  /** Ligne d'attribution affichée sous le contrôle (ex. créateur d'une police). */
  credit?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const current = options.find((option) => option.value === value);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 4;
    const width = Math.min(menuWidth, viewportW - 16);
    const spaceBelow = viewportH - rect.bottom;
    // Ouvre vers le haut quand il n'y a pas assez de place en dessous.
    const up = spaceBelow < 200 && rect.top > spaceBelow;
    // Hauteur bornée : le menu reste compact (ex. les 43 polices ne doivent
    // pas dérouler sur tout l'écran) et défile au-delà de 320 px.
    const maxHeight = Math.min(320, Math.max(120, (up ? rect.top : spaceBelow) - gap * 2));
    const left = Math.max(8, Math.min(rect.left, viewportW - width - 8));
    setPosition({
      left,
      width,
      top: up ? undefined : rect.bottom + gap,
      bottom: up ? viewportH - rect.top + gap : undefined,
      maxHeight,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onScroll = (event: Event) => {
      // Le menu est porté dans <body> : on ignore son propre défilement.
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const button = (
    <button
      ref={buttonRef}
      id={label ? id : undefined}
      type="button"
      onClick={() => (open ? setOpen(false) : openMenu())}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel ?? label}
      className={[
        "flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent",
        className ?? "w-40",
      ].join(" ")}
    >
      <span className="truncate" style={current?.fontStack ? { fontFamily: current.fontStack } : undefined}>
        {current?.label}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        fill="none"
        className={["size-3 shrink-0 text-content-muted transition-transform", open ? "rotate-180" : ""].join(" ")}
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  const control = (
    <>
      {button}
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={menuRef}
              role="listbox"
              className="fixed z-[100] overflow-y-auto rounded-lg border border-border-subtle bg-surface-1 p-1 shadow-lg"
              style={{
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
                // L'animation zoom/fondu se déploie depuis le bord d'ancrage
                // (haut si le menu s'ouvre vers le bas, bas sinon).
                transformOrigin: position.top !== undefined ? "top" : "bottom",
                animation: "menu-pop 140ms ease-out",
              }}
            >
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <li key={option.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={[
                        "w-full truncate rounded-md px-2 py-1.5 text-left text-xs",
                        selected ? "bg-surface-2 text-content-primary" : "text-content-secondary hover:bg-surface-2",
                      ].join(" ")}
                      style={option.fontStack ? { fontFamily: option.fontStack } : undefined}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </>
  );

  if (!label) return control;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-content-secondary">
          {label}
        </label>
        {control}
      </div>
      {credit ? (
        <p className="mt-1 text-[11px] leading-snug text-content-muted">{credit}</p>
      ) : null}
    </div>
  );
}

export function TextInputControl({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-content-secondary">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}

export function TextAreaControl({
  label,
  value,
  placeholder,
  rows = 3,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-content-secondary">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="resize-y rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}

export function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  // Replié par défaut : la liste des catégories reste compacte, on ouvre
  // seulement ce qu'on règle.
  const [open, setOpen] = useState(false);

  return (
    <section className="border-b border-border-subtle py-4 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-content-muted">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="min-w-0 flex-1">{title}</span>
          <svg
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className={["size-3 shrink-0 transition-transform duration-300 ease-linear", open ? "rotate-0" : "-rotate-90"].join(" ")}
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      {/* Ouverture/fermeture animée : une grille passe de 0fr → 1fr (300 ms,
          linéaire). Le contenu reste monté pour que la transition s'applique,
          mais il est masqué par overflow:hidden quand la rangée fait 0. Le
          contenu est rendu inerte (inert) quand c'est replié pour ne pas être
          atteignable au clavier ni par les lecteurs d'écran. */}
      <div
        id={id}
        className="grid"
        inert={!open ? true : undefined}
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 300ms linear",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 pt-3">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
