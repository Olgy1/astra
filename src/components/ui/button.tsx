import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:hover:bg-accent",
  secondary:
    "bg-surface-2 text-content-primary hover:bg-surface-3 border border-border-subtle disabled:hover:bg-surface-2",
  ghost: "text-content-secondary hover:text-content-primary hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  // 40px et 48px de haut : au-dessus du minimum de 44px recommandé pour une
  // cible tactile sur les tailles md et lg, qui sont celles des formulaires.
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3.5 text-sm rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = "",
  ...props
}: Props) {
  return (
    <button
      // Un bouton en cours de chargement reste focusable mais refuse le clic :
      // le retirer du flux de focus ferait sauter le curseur clavier ailleurs
      // pendant la soumission.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
