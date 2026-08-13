import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  info: "border-border-subtle bg-surface-2 text-content-secondary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

export function Alert({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div
      // role="alert" sur les tons négatifs uniquement : il interrompt le
      // lecteur d'écran. Un message de succès n'a pas à couper la parole.
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
