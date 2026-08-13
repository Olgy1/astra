"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useEditor, type EditorBlock } from "@/lib/editor/store";
import { useDragOrder } from "@/lib/editor/use-drag-order";
import { Button } from "@/components/ui/button";
import { BlockConfigForm } from "@/components/editor/block-config";

type CatalogEntry = {
  type: string;
  label: string;
  description: string;
  category: string;
  maxPerBiolink: number | null;
};

/**
 * Gestion des blocks : ajout depuis le catalogue, réordonnancement,
 * suppression, activation.
 *
 * Le catalogue est chargé depuis l'API (`/api/blocks/catalog`), pas codé en
 * dur : ajouter un type de block au registry le fait apparaître ici sans
 * toucher à ce fichier.
 */
export function BlocksPanel() {
  const { biolink, setBlocks } = useEditor();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ catalog: CatalogEntry[] }>("/api/blocks/catalog").then((result) => {
      if (result.ok) setCatalog(result.data.catalog);
    });
  }, []);

  const drag = useDragOrder(biolink.blocks, (ordered) => {
    setBlocks(ordered.map((block, index) => ({ ...block, position: index })));
  });

  function handleAdd(type: string) {
    // Création locale (id généré par le navigateur) : le block ne part en
    // base qu'au clic sur Enregistrer, qui le validera côté serveur (type,
    // limite d'instances, config). La config vide est complétée par les
    // défauts du schéma à la sauvegarde.
    const block: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      config: {},
      position: biolink.blocks.length,
      isEnabled: true,
    };
    setBlocks([...biolink.blocks, block]);
    setPicking(false);
  }

  function handleDelete(id: string) {
    setBlocks(biolink.blocks.filter((block) => block.id !== id));
  }

  function handleToggle(id: string, isEnabled: boolean) {
    setBlocks(biolink.blocks.map((block) => (block.id === id ? { ...block, isEnabled } : block)));
  }

  // Compte des instances par type, pour griser dans le catalogue ceux qui ont
  // atteint leur limite (un seul avatar, un seul header…).
  const counts = biolink.blocks.reduce<Record<string, number>>((acc, block) => {
    acc[block.type] = (acc[block.type] ?? 0) + 1;
    return acc;
  }, {});

  const labelOf = (type: string) => catalog.find((c) => c.type === type)?.label ?? type;

  return (
    <div className="flex flex-col gap-3 py-4">
      <ul className="flex flex-col gap-2">
        {biolink.blocks.map((block) => (
          <li
            key={block.id}
            className={[
              "flex flex-col rounded-xl border bg-surface-1 transition-colors",
              drag.overId === block.id ? "border-accent" : "border-border-subtle",
              block.isEnabled ? "" : "opacity-60",
            ].join(" ")}
          >
            <div {...drag.handlers(block.id)} className="flex items-center gap-2 p-3">
              <span className="cursor-grab text-content-muted active:cursor-grabbing" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm8-14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" /></svg>
              </span>
              <button
                type="button"
                onClick={() => setExpanded(expanded === block.id ? null : block.id)}
                className="flex flex-1 items-center gap-1.5 text-left text-sm font-medium"
                aria-expanded={expanded === block.id}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={["size-3.5 shrink-0 fill-current text-content-muted transition-transform", expanded === block.id ? "rotate-90" : ""].join(" ")}
                >
                  <path d="M8.6 4.6 15.4 12l-6.8 7.4-1.5-1.4 5.4-6-5.4-6z" />
                </svg>
                {labelOf(block.type)}
              </button>
              <button type="button" onClick={() => handleToggle(block.id, !block.isEnabled)} className="text-xs text-content-muted hover:text-content-primary">
                {block.isEnabled ? "Visible" : "Masqué"}
              </button>
              <button type="button" onClick={() => handleDelete(block.id)} className="text-content-muted transition-colors hover:text-danger" aria-label="Supprimer le block">
                <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              </button>
            </div>
            {expanded === block.id && (
              <div className="border-t border-border-subtle px-3 pb-3 pt-3">
                <BlockConfigForm block={block} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {picking ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-1 p-3">
          <p className="text-xs font-medium text-content-muted">Choisir un block</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {catalog.map((entry) => {
              const atLimit = entry.maxPerBiolink !== null && (counts[entry.type] ?? 0) >= entry.maxPerBiolink;
              return (
                <li key={entry.type}>
                  <button
                    type="button"
                    disabled={atLimit}
                    onClick={() => handleAdd(entry.type)}
                    className="w-full rounded-lg border border-border-subtle bg-surface-2 p-2 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
                    title={atLimit ? "Déjà présent (limité)" : entry.description}
                  >
                    <p className="text-xs font-medium">{entry.label}</p>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>Fermer</Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)} fullWidth>
          + Ajouter un block
        </Button>
      )}
    </div>
  );
}
