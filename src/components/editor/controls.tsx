"use client";

import { useId } from "react";

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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--color-accent)]"
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

export function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-content-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
  return (
    <section className="flex flex-col gap-3 border-b border-border-subtle py-4 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-content-muted">{title}</h3>
      {children}
    </section>
  );
}
