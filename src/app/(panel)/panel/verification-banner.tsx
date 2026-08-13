"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/**
 * Rappel de vérification d'email.
 *
 * L'inscription ouvre une session sans attendre la confirmation, pour ne pas
 * bloquer l'utilisateur sur un écran d'attente. Cette bannière est la
 * contrepartie : elle rappelle l'action tant qu'elle n'est pas faite, et le
 * backend refuse la publication en attendant.
 */

type ResendResponse = {
  message: string;
  /** Présent seulement en développement, quand aucun SMTP n'est configuré. */
  devLink?: string;
};

export function EmailVerificationBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setState("sending");
    setError(null);

    const result = await api.post<ResendResponse>("/api/auth/verify-email/resend");

    if (!result.ok) {
      setError(result.message);
      setState("idle");
      return;
    }

    setMessage(result.data.message);
    setDevLink(result.data.devLink ?? null);
    setState("sent");
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-medium text-warning">Confirmez votre adresse email</p>
          <p className="mt-1 text-content-secondary">
            {error ?? message ?? `Votre page ne pourra pas être publiée tant que ${email} n'est pas confirmée.`}
          </p>
        </div>

        {state !== "sent" && (
          <Button
            variant="secondary"
            size="sm"
            loading={state === "sending"}
            onClick={handleResend}
            className="shrink-0"
          >
            Renvoyer le lien
          </Button>
        )}
      </div>

      {/*
        Raccourci de développement. Le serveur ne renvoie `devLink` que si
        NODE_ENV vaut "development" ET qu'aucun SMTP n'est configuré : en
        production, ce bloc ne peut pas s'afficher. Il est encadré et
        explicitement étiqueté pour qu'on ne le prenne jamais pour une
        fonctionnalité du produit.
      */}
      {devLink && (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-2 p-3">
          <p className="text-xs font-medium text-content-muted">
            Mode développement — aucun serveur SMTP configuré
          </p>
          <p className="mt-1 text-xs text-content-secondary">
            L&apos;email n&apos;a pas été envoyé. Voici le lien qu&apos;il aurait contenu :
          </p>
          <a
            href={devLink}
            className="mt-2 inline-block break-all text-xs text-accent hover:underline"
          >
            {devLink}
          </a>
        </div>
      )}
    </div>
  );
}
