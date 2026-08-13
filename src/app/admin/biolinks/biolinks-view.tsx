"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type BiolinkRow = {
  id: string;
  slug: string;
  title: string | null;
  isPublished: boolean;
  isPasswordProtected: boolean;
  totalViews: number;
  uniqueViews: number;
  createdAt: string;
  owner: { id: string; username: string };
  _count: { links: number; blocks: number };
};

type ListResponse = {
  biolinks: BiolinkRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export function BiolinksView() {
  const [query, setQuery] = useState("");
  const [published, setPublished] = useState<"true" | "false" | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Formulaire de création pour un compte tiers
  const [showCreate, setShowCreate] = useState(false);
  const [newOwner, setNewOwner] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query.trim()) params.set("q", query.trim());
    if (published) params.set("published", published);

    api.get<ListResponse>(`/api/admin/biolinks?${params}`).then((result) => {
      if (result.ok) setData(result.data);
      else setError(result.message);
    });
  }, [query, published, page]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, body: { isPublished?: boolean }) => {
    setBusy(id);
    setError(null);
    const result = await api.patch<{ biolink: BiolinkRow }>(`/api/admin/biolinks/${id}`, body);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    load();
  };

  const remove = async (id: string, slug: string) => {
    if (!window.confirm(`Supprimer définitivement la page astra.is-a.dev/${slug} ?`)) return;
    setBusy(id);
    setError(null);
    setNotice(null);
    const result = await api.delete<{ message?: string }>(`/api/admin/biolinks/${id}`);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Page supprimée.");
    load();
  };

  const resetStats = async (id: string, slug: string) => {
    if (
      !window.confirm(
        `Réinitialiser à 0 les statistiques de astra.is-a.dev/${slug} ? Les vues, visites et données journalières seront définitivement effacées.`
      )
    )
      return;
    setBusy(`stats:${id}`);
    setError(null);
    setNotice(null);
    const result = await api.post<{ message?: string }>(`/api/admin/biolinks/${id}/stats`, {});
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Statistiques réinitialisées.");
    load();
  };

  const createForUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    const result = await api.post<{ biolink: BiolinkRow }>("/api/admin/biolinks", {
      ownerUsername: newOwner.trim(),
      slug: newSlug.trim().toLowerCase(),
      title: newTitle.trim() || undefined,
    });
    if (!result.ok) {
      setCreateError(result.message);
      return;
    }
    setNotice(`Page astra.is-a.dev/${result.data.biolink.slug} créée.`);
    setNewOwner("");
    setNewSlug("");
    setNewTitle("");
    setShowCreate(false);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher un slug, un titre…"
          className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          + Créer pour un compte
        </button>
        <div className="flex gap-2">
          <select
            value={published}
            onChange={(event) => {
              setPublished(event.target.value as typeof published);
              setPage(1);
            }}
            className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Publication : tous</option>
            <option value="true">En ligne</option>
            <option value="false">Brouillon</option>
          </select>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={createForUser} className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
          <h2 className="text-sm font-medium">Créer une page pour un compte</h2>
          <p className="mt-1 text-xs text-content-muted">
            Seul chemin qui contourne le quota « 1 page par membre » — l'opération
            est journalisée. Le compte doit exister (pseudo exact).
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={newOwner}
              onChange={(event) => setNewOwner(event.target.value)}
              placeholder="Pseudo du compte propriétaire"
              className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
            <input
              value={newSlug}
              onChange={(event) => setNewSlug(event.target.value.toLowerCase())}
              placeholder="slug"
              className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Titre (optionnel)"
              className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newOwner.trim() || !newSlug.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              Créer
            </button>
          </div>
          {createError && (
            <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
              {createError}
            </p>
          )}
        </form>
      )}

      {notice && (
        <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</p>
      )}
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      {!data && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="overflow-hidden rounded-2xl border border-border-subtle">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/60 text-xs text-content-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Page</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Propriétaire</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Vues</th>
                  <th className="px-4 py-2.5 font-medium">État</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.biolinks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-content-muted">
                      Aucune page ne correspond à cette recherche.
                    </td>
                  </tr>
                )}
                {data.biolinks.map((biolink) => (
                  <tr key={biolink.id} className="bg-surface-1/60 transition-colors hover:bg-surface-1">
                    <td className="px-4 py-3">
                      <a
                        href={`/${biolink.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-content-primary hover:text-accent"
                      >
                        astra.is-a.dev/{biolink.slug}
                      </a>
                      <span className="block max-w-64 truncate text-xs text-content-muted">
                        {biolink.title || "Sans titre"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-content-secondary sm:table-cell">
                      {biolink.owner.username}
                    </td>
                    <td className="hidden px-4 py-3 text-xs tabular-nums md:table-cell">
                      {biolink.uniqueViews}
                      <span className="block text-content-muted">
                        {biolink.totalViews} vues
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {biolink.isPasswordProtected && (
                          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-content-muted" title="Protégé par mot de passe">
                            <svg viewBox="0 0 24 24" className="size-3 fill-current" aria-hidden>
                              <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
                            </svg>
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 ${biolink.isPublished ? "bg-success/15 text-success" : "bg-surface-3 text-content-muted"}`}>
                          {biolink.isPublished ? "En ligne" : "Brouillon"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busy === biolink.id}
                          onClick={() => patch(biolink.id, { isPublished: !biolink.isPublished })}
                          className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
                        >
                          {biolink.isPublished ? "Dépublier" : "Publier"}
                        </button>
                        <button
                          type="button"
                          disabled={busy === `stats:${biolink.id}`}
                          onClick={() => resetStats(biolink.id, biolink.slug)}
                          title="Réinitialiser les statistiques de vues et visites"
                          className="rounded-lg bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/25 disabled:opacity-50"
                        >
                          Réinit. stats
                        </button>
                        <button
                          type="button"
                          disabled={busy === biolink.id}
                          onClick={() => remove(biolink.id, biolink.slug)}
                          className="rounded-lg bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-content-muted">
            <span>
              {data.pagination.total} page(s) — page {data.pagination.page} sur {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                ← Précédent
              </button>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
