"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type SlugRow = {
  id: string;
  slug: string;
  tier: "RESERVED" | "PREMIUM";
  reason: string | null;
  createdAt: string;
};

export function SlugsView() {
  const [slugs, setSlugs] = useState<SlugRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Formulaire
  const [newSlug, setNewSlug] = useState("");
  const [newTier, setNewTier] = useState<"RESERVED" | "PREMIUM">("RESERVED");
  const [newReason, setNewReason] = useState("");

  // Blacklist
  const [blacklist, setBlacklist] = useState<string[] | null>(null);
  const [blacklistInput, setBlacklistInput] = useState("");

  const loadBlacklist = useCallback(() => {
    api.get<{ words: { id: string; word: string }[] }>("/api/admin/slugs/blacklist").then((result) => {
      if (result.ok) setBlacklist(result.data.words.map((w) => w.word));
    });
  }, []);

  useEffect(() => {
    loadBlacklist();
  }, [loadBlacklist]);

  const addBlacklist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!blacklistInput.trim()) return;
    setError(null);
    setNotice(null);
    const result = await api.post<{ added: string[]; duplicates: number }>(
      "/api/admin/slugs/blacklist",
      { words: blacklistInput }
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.data.added.length > 0) {
      setNotice(
        `Ajouté : ${result.data.added.join(", ")}${result.data.duplicates > 0 ? ` (${result.data.duplicates} déjà présents)` : ""}.`
      );
    } else {
      setNotice(`Ces mots étaient déjà dans la blacklist (${result.data.duplicates}).`);
    }
    setBlacklistInput("");
    loadBlacklist();
  };

  const removeBlacklist = async (word: string) => {
    if (!window.confirm(`Retirer « ${word} » de la blacklist ? Les slugs contenant ce mot redeviendront autorisés.`)) return;
    setBusy(`bl:${word}`);
    setError(null);
    setNotice(null);
    const result = await api.delete<{ message?: string }>(`/api/admin/slugs/blacklist/${encodeURIComponent(word)}`);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Mot retiré de la blacklist.");
    loadBlacklist();
  };

  const load = useCallback(() => {
    setError(null);
    api.get<{ slugs: SlugRow[] }>("/api/admin/slugs").then((result) => {
      if (result.ok) setSlugs(result.data.slugs);
      else setError(result.message);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reserve = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const result = await api.post<{ slug: SlugRow }>("/api/admin/slugs", {
      slug: newSlug,
      tier: newTier,
      reason: newReason.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(`Le lien « ${result.data.slug.slug} » est réservé.`);
    setNewSlug("");
    setNewReason("");
    load();
  };

  const release = async (slug: string) => {
    if (!window.confirm(`Libérer le lien « ${slug} » ? Il redeviendra disponible pour tous.`)) return;
    setBusy(slug);
    setError(null);
    setNotice(null);
    const result = await api.delete<{ message?: string }>(`/api/admin/slugs/${slug}`);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Lien libéré.");
    load();
  };

  const reserved = slugs?.filter((slug) => slug.tier === "RESERVED") ?? [];
  const premium = slugs?.filter((slug) => slug.tier === "PREMIUM") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={reserve} className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
        <h2 className="text-sm font-medium">Réserver un lien</h2>
        <p className="mt-1 text-xs text-content-muted">
          RESERVED = interdit à tous (mots réservés, marques, insultes). PREMIUM =
          attribuable uniquement par un admin (slugs courts, recherchés).
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={newSlug}
            onChange={(event) => setNewSlug(event.target.value.toLowerCase())}
            placeholder="slug"
            className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <select
            value={newTier}
            onChange={(event) => setNewTier(event.target.value as typeof newTier)}
            className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="RESERVED">Réservé</option>
            <option value="PREMIUM">Premium</option>
          </select>
          <input
            value={newReason}
            onChange={(event) => setNewReason(event.target.value)}
            placeholder="Motif (optionnel)"
            className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Réserver
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">{error}</p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg border border-success/30 bg-success/10 p-2.5 text-xs text-success">{notice}</p>
        )}
      </form>

      <form onSubmit={addBlacklist} className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
        <h2 className="text-sm font-medium">Blacklist de mots interdits</h2>
        <p className="mt-1 text-xs text-content-muted">
          Tout slug contenant un de ces mots sera refusé à la création et au changement.
          Ajoutez un mot par ligne, ou séparez-les par des virgules — la liste est
          automatiquement triée et les doublons ignorés.
        </p>
        <textarea
          value={blacklistInput}
          onChange={(event) => setBlacklistInput(event.target.value)}
          rows={4}
          placeholder={"insulte1\ninsulte2\nmarque, mot"}
          className="mt-3 w-full resize-y rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          disabled={!blacklistInput.trim()}
          className="mt-3 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/85 disabled:opacity-50"
        >
          Bloquer ces mots
        </button>
        {blacklist === null ? (
          <div className="mt-4 h-10 animate-pulse rounded-lg bg-surface-2" />
        ) : blacklist.length === 0 ? (
          <p className="mt-4 text-sm text-content-muted">Aucun mot interdit. La blacklist est vide.</p>
        ) : (
          <ul className="mt-4 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
            {blacklist.map((word) => (
              <li
                key={word}
                className="flex items-center gap-1 rounded-lg bg-danger/10 px-2 py-1 font-mono text-xs text-danger"
              >
                {word}
                <button
                  type="button"
                  disabled={busy === `bl:${word}`}
                  onClick={() => removeBlacklist(word)}
                  className="ml-1 rounded px-1 text-danger/70 transition-colors hover:bg-danger/20 hover:text-danger disabled:opacity-50"
                  title={`Retirer « ${word} »`}
                >
                  <svg viewBox="0 0 24 24" className="size-3 fill-current" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293a1 1 0 0 0-1.414-1.414L12 10.586Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {!slugs && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {slugs && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
            <h2 className="text-sm font-medium">
              Slugs réservés <span className="text-content-muted">({reserved.length})</span>
            </h2>
            {reserved.length === 0 ? (
              <p className="mt-3 text-sm text-content-muted">Aucun slug réservé.</p>
            ) : (
              <ul className="mt-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto">
                {reserved.map((slug) => (
                  <li key={slug.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                    <div className="min-w-0">
                      <span className="font-mono text-sm">{slug.slug}</span>
                      {slug.reason && (
                        <span className="ml-2 text-xs text-content-muted">{slug.reason}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busy === slug.slug}
                      onClick={() => release(slug.slug)}
                      className="shrink-0 rounded-md px-2 py-0.5 text-xs text-content-muted transition-colors hover:bg-surface-3 hover:text-danger disabled:opacity-50"
                    >
                      Libérer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
            <h2 className="text-sm font-medium">
              Slugs premium <span className="text-content-muted">({premium.length})</span>
            </h2>
            {premium.length === 0 ? (
              <p className="mt-3 text-sm text-content-muted">Aucun slug premium.</p>
            ) : (
              <ul className="mt-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto">
                {premium.map((slug) => (
                  <li key={slug.id} className="flex items-center justify-between gap-2 rounded-lg bg-accent-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <span className="font-mono text-sm text-accent">{slug.slug}</span>
                      {slug.reason && (
                        <span className="ml-2 text-xs text-content-muted">{slug.reason}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busy === slug.slug}
                      onClick={() => release(slug.slug)}
                      className="shrink-0 rounded-md px-2 py-0.5 text-xs text-content-muted transition-colors hover:bg-surface-3 hover:text-danger disabled:opacity-50"
                    >
                      Libérer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
