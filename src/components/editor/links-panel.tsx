"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { useEditor, type EditorLink } from "@/lib/editor/store";
import { useDragOrder } from "@/lib/editor/use-drag-order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Gestion des liens : ajout, édition, suppression, réordonnancement.
 *
 * Chaque action est optimiste — l'interface se met à jour d'abord, la requête
 * suit. En cas d'échec, on recharge depuis le serveur plutôt que de laisser
 * l'affichage mentir sur l'état réel.
 */
export function LinksPanel() {
  const { biolink, setLinks } = useEditor();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const drag = useDragOrder(biolink.links, async (ordered) => {
    setLinks(ordered.map((link, index) => ({ ...link, position: index })));

    const result = await api.put(`/api/biolinks/${biolink.id}/links/order`, {
      ids: ordered.map((link) => link.id),
    });

    // L'ordre a été refusé (course, lien supprimé ailleurs) : on resynchronise.
    if (!result.ok) await reload();
  });

  async function reload() {
    const result = await api.get<{ links: EditorLink[] }>(`/api/biolinks/${biolink.id}/links`);
    if (result.ok) setLinks(result.data.links);
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const result = await api.post<{ link: EditorLink }>(`/api/biolinks/${biolink.id}/links`, { label, url });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setLinks([...biolink.links, result.data.link]);
    setLabel("");
    setUrl("");
    setAdding(false);
  }

  async function handleUpdate(id: string, patch: Partial<EditorLink>) {
    setLinks(biolink.links.map((link) => (link.id === id ? { ...link, ...patch } : link)));
    await api.patch(`/api/biolinks/${biolink.id}/links/${id}`, patch);
  }

  async function handleDelete(id: string) {
    setLinks(biolink.links.filter((link) => link.id !== id));
    const result = await api.delete(`/api/biolinks/${biolink.id}/links/${id}`);
    if (!result.ok) await reload();
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <ul className="flex flex-col gap-2">
        {biolink.links.map((link) => (
          <li
            key={link.id}
            {...drag.handlers(link.id)}
            className={[
              "flex items-center gap-2 rounded-xl border bg-surface-1 p-3 transition-colors",
              drag.overId === link.id ? "border-accent" : "border-border-subtle",
              link.isEnabled ? "" : "opacity-50",
            ].join(" ")}
          >
            <span className="cursor-grab text-content-muted active:cursor-grabbing" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm8-14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" /></svg>
            </span>

            <div className="min-w-0 flex-1">
              <input
                value={link.label}
                onChange={(event) => handleUpdate(link.id, { label: event.target.value })}
                className="w-full truncate bg-transparent text-sm font-medium outline-none"
                aria-label="Libellé du lien"
              />
              <input
                value={link.url}
                onChange={(event) => handleUpdate(link.id, { url: event.target.value })}
                className="w-full truncate bg-transparent text-xs text-content-muted outline-none"
                aria-label="URL du lien"
              />
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs text-content-muted" aria-hidden>Icône</span>
                <input
                  value={link.icon ?? ""}
                  onChange={(event) => handleUpdate(link.id, { icon: event.target.value || null })}
                  className="w-full truncate rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
                  placeholder="émoji 🎮 ou URL d'image"
                  aria-label="Icône du lien (émoji ou URL)"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleUpdate(link.id, { isEnabled: !link.isEnabled })}
              className="shrink-0 text-xs text-content-muted hover:text-content-primary"
              title={link.isEnabled ? "Masquer" : "Afficher"}
            >
              {link.isEnabled ? "Visible" : "Masqué"}
            </button>

            <button
              type="button"
              onClick={() => handleDelete(link.id)}
              className="shrink-0 text-content-muted transition-colors hover:text-danger"
              aria-label="Supprimer le lien"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-1 p-3">
          <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus required />
          <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" errors={error ? [error] : undefined} required />
          <div className="flex gap-2">
            <Button type="submit" size="sm">Ajouter</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setError(null); }}>Annuler</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)} fullWidth>
          + Ajouter un lien
        </Button>
      )}
    </div>
  );
}
