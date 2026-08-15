"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/**
 * Création d'une page depuis le panel.
 *
 * Vérifie la disponibilité du slug à la frappe (débattue) pour un retour
 * immédiat, mais la création s'appuie de toute façon sur la réponse du
 * serveur : le contrôle de disponibilité est indicatif, l'unicité est
 * garantie en base.
 */
export function CreatePageButton({ suggestedSlug }: { suggestedSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(suggestedSlug.toLowerCase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuggestions([]);

    const result = await api.post<{ biolink: { id: string } }>("/api/biolinks", { slug });

    if (!result.ok) {
      setError(result.message);
      setLoading(false);

      // Si le slug est pris, l'API de vérification propose des alternatives.
      const check = await api.get<{ suggestions: string[] }>(`/api/slugs/check?slug=${encodeURIComponent(slug)}`);
      if (check.ok) setSuggestions(check.data.suggestions);
      return;
    }

    // Droit dans l'éditeur : c'est là que l'utilisateur veut aller.
    router.push(`/panel/edit/${result.data.biolink.id}`);
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Créer une page
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !loading && setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-1 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Créer votre page</h2>
        <p className="mt-1 text-sm text-content-muted">Choisissez son adresse. Vous pourrez la changer plus tard.</p>

        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3">
          <Input
            label="Adresse"
            prefix="astraa.is-cool.dev/"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            errors={error ? [error] : undefined}
            autoFocus
            required
          />

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => { setSlug(suggestion); setError(null); setSuggestions([]); }}
                  className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs hover:bg-surface-3"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={loading} fullWidth>Créer</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
