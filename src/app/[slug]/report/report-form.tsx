"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Formulaire de signalement d'une page bio.
 *
 * Le signalement est anonyme si le visiteur n'est pas connecté (l'API trace
 * l'auteur quand il l'est, pour repérer les abus). Le commentaire part dans
 * `details`, avec une raison générique — c'est le texte libre qui intéresse
 * la modération.
 */
export function ReportForm({ slug }: { slug: string }) {
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/public/${slug}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "other",
        details: details.trim() || undefined,
      }),
    });

    const json = await response.json().catch(() => null);

    setBusy(false);

    if (response.ok && json?.ok) {
      setSent(true);
    } else {
      setError(json?.error?.message ?? "Le signalement n'a pas pu être envoyé. Réessayez dans un instant.");
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-border-subtle bg-surface-1 p-6">
        <header className="text-center">
          <h1 className="text-xl font-semibold">Merci</h1>
          <p className="mt-2 text-sm text-content-secondary">
            Votre signalement a bien été transmis à notre équipe de modération.
          </p>
        </header>

        <Alert tone="success">
          Le signalement pour <span className="font-mono">astra.is-a.dev/{slug}</span> a été enregistré.
        </Alert>

        <Link href={`/${slug}`} className="flex justify-center">
          <Button type="button">Retour à la page</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border-subtle bg-surface-1 p-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">Signaler la page</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Confirmer le signalement pour :
        </p>
        <p className="mt-1 font-mono text-sm text-accent">astra.is-a.dev/{slug}</p>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-secondary">
            Commentaire <span className="font-normal text-content-muted">(optionnel)</span>
          </span>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Décrivez le problème : contenu inapproprié, usurpation, lien suspect…"
            rows={4}
            maxLength={1000}
            className="resize-none rounded-xl border border-border-subtle bg-surface-0 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-content-muted focus:border-accent"
          />
        </label>

        <div className="flex flex-col gap-2">
          <Button type="submit" loading={busy} fullWidth>
            Envoyer le signalement
          </Button>
          <Link
            href={`/${slug}`}
            className="flex w-full items-center justify-center rounded-xl border border-border-subtle bg-surface-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-3"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
