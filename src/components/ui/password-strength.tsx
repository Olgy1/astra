"use client";

import { estimateStrength } from "@/lib/auth/password-policy";

/**
 * Jauge de force du mot de passe.
 *
 * Purement indicative : elle guide la saisie mais n'autorise rien. La règle
 * qui fait foi est `passwordSchema`, revérifiée côté serveur à chaque
 * inscription et changement.
 */

const BAR_COLORS = [
  "bg-danger",
  "bg-danger",
  "bg-warning",
  "bg-success",
  "bg-success",
] as const;

const TEXT_COLORS = [
  "text-danger",
  "text-danger",
  "text-warning",
  "text-success",
  "text-success",
] as const;

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const { score, label, suggestions } = estimateStrength(password);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 gap-1"
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-label={`Force du mot de passe : ${label}`}
        >
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index < score ? BAR_COLORS[score] : "bg-surface-3"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${TEXT_COLORS[score]}`}>{label}</span>
      </div>

      {suggestions.length > 0 && (
        <p className="text-xs text-content-muted">{suggestions[0]}</p>
      )}
    </div>
  );
}
