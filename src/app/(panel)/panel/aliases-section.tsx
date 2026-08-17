"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Alias = { id: string; slug: string; biolinkSlug: string };
type BiolinkOption = { id: string; slug: string };

/**
 * Gestion des alias depuis le panel membre.
 *
 * Un alias est une adresse courte qui redirige vers la page bio choisie.
 * Les données viennent du serveur (props) ; création et suppression passent
 * par l'API puis rechargent le panel via router.refresh().
 */
export function AliasesSection({
  aliases,
  biolinks,
  aliasLimit,
}: {
  aliases: Alias[];
  biolinks: BiolinkOption[];
  aliasLimit: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [targetId, setTargetId] = useState(biolinks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const canCreateMore = aliasLimit === null || aliases.length < aliasLimit;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await api.post<{ alias: Alias }>("/api/aliases", {
      slug,
      biolinkId: targetId,
    });

    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSlug("");
    setOpen(false);
    router.refresh();
  }

  async function handleDelete(alias: Alias) {
    if (!window.confirm(`Supprimer l'alias astraa.is-cool.dev/${alias.slug} ?`)) return;
    setBusy(alias.id);
    setError(null);

    const result = await api.delete(`/api/aliases/${alias.id}`);
    setBusy(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-1 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Alias</h2>
          <p className="mt-1 text-xs text-content-muted">
            Des adresses courtes qui redirigent vers votre page bio.
          </p>
        </div>
        {canCreateMore && biolinks.length > 0 && (
          <Button size="sm" onClick={() => setOpen(!open)}>
            {open ? "Annuler" : "Ajouter un alias"}
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
          <Input
            label="Alias"
            prefix="astraa.is-cool.dev/"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            errors={error ? [error] : undefined}
            autoFocus
            required
          />
          {biolinks.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-content-secondary">Redirige vers</span>
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {biolinks.map((biolink) => (
                  <option key={biolink.id} value={biolink.id}>
                    astraa.is-cool.dev/{biolink.slug}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <Button type="submit" size="sm" loading={loading} disabled={!slug.trim() || !targetId}>
              Créer l&apos;alias
            </Button>
          </div>
        </form>
      )}

      {aliases.length === 0 ? (
        <p className="mt-3 text-sm text-content-muted">
          {biolinks.length === 0
            ? "Créez d'abord une page pour lui associer des alias."
            : "Aucun alias. Ajoutez-en un pour obtenir une adresse courte supplémentaire."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {aliases.map((alias) => (
            <li
              key={alias.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">astraa.is-cool.dev/{alias.slug}</p>
                <p className="mt-0.5 text-xs text-content-muted">
                  → astraa.is-cool.dev/{alias.biolinkSlug}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === alias.id}
                onClick={() => handleDelete(alias)}
                className="shrink-0 rounded-lg bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-content-muted">
        {aliasLimit === null
          ? `${aliases.length} alias · illimité`
          : `${aliases.length} / ${aliasLimit} alias`}
      </p>
    </section>
  );
}
