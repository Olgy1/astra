"use client";

import { useState } from "react";
import Link from "next/link";
import { useEditor } from "@/lib/editor/store";
import { Button } from "@/components/ui/button";
import { ThemePanel } from "@/components/editor/theme-panel";
import { LinksPanel } from "@/components/editor/links-panel";
import { BlocksPanel } from "@/components/editor/blocks-panel";
import { SettingsPanel } from "@/components/editor/settings-panel";

/**
 * Coque de l'éditeur.
 *
 * L'écran entier est dédié aux réglages : plus d'aperçu ni d'onglets. Tous les
 * panneaux (thème, blocks, liens, réglages) s'affichent en même temps, sur
 * toute la largeur, dans une grille responsive qui se déploie sur grand écran.
 */
export function EditorShell() {
  const { biolink, saveState, patchBiolink, save, flush, undo, redo, canUndo, canRedo } = useEditor();
  const [publishing, setPublishing] = useState(false);

  // Suspension de modération : la publication est verrouillée tant que la
  // date n'est pas passée. Le contenu, lui, reste modifiable — c'est le but.
  const suspended =
    Boolean(biolink.suspendedUntil) && new Date(biolink.suspendedUntil!) > new Date();

  async function togglePublish() {
    if (suspended) return;
    setPublishing(true);
    patchBiolink({ isPublished: !biolink.isPublished });
    await flush();
    setPublishing(false);
  }

  return (
    <div className="flex h-dvh flex-col bg-surface-0">
      <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/panel" className="text-content-muted transition-colors hover:text-content-primary" aria-label="Retour au panel">
            <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">astra.is-a.dev/{biolink.slug}</span>
            <SaveIndicator state={saveState} />
            <div className="flex items-center gap-1" role="group" aria-label="Annuler / rétablir">
              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                title="Retour arrière"
                aria-label="Retour arrière"
                className="flex size-7 items-center justify-center rounded-lg border border-border-subtle bg-surface-1 text-content-secondary transition-colors hover:bg-surface-2 hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
                  <path d="M9.41 11 15 5.41 13.59 4 6 11.59 13.59 19.59 15 18.18 9.41 12.59H20v-1.59H9.41Z" />
                </svg>
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={redo}
                title="Retour avant"
                aria-label="Retour avant"
                className="flex size-7 items-center justify-center rounded-lg border border-border-subtle bg-surface-1 text-content-secondary transition-colors hover:bg-surface-2 hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
                  <path d="M14.59 11H4v1.59h10.59L9 18.18 10.41 19.59 18 12 10.41 4.41 9 5.82l5.59 5.18Z" />
                </svg>
              </button>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={saveState === "saving"}
              disabled={saveState === "saved"}
              onClick={save}
            >
              Enregistrer
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a href={`/${biolink.slug}`} target="_blank" rel="noopener" className="hidden text-xs text-content-muted hover:text-content-primary sm:block">
            Voir la page
          </a>
          <Link href={`/panel/stats/${biolink.id}`} className="hidden text-xs text-content-muted hover:text-content-primary sm:block">
            Statistiques
          </Link>
          <Button
            size="sm"
            variant={biolink.isPublished ? "secondary" : "primary"}
            loading={publishing}
            disabled={suspended}
            onClick={togglePublish}
            title={suspended ? "Publication verrouillée pendant la suspension" : undefined}
          >
            {biolink.isPublished ? "Dépublier" : "Publier"}
          </Button>
        </div>
      </header>

      {suspended && (
        <div className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger">
          Page suspendue par la modération
          {biolink.suspensionReason ? ` : ${biolink.suspensionReason}` : ""} — la
          publication est verrouillée jusqu&apos;à la fin de la suspension, mais vous
          pouvez modifier le contenu pour corriger le problème.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-6xl gap-8 p-4 sm:p-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <ThemePanel />
          </div>
          <BlocksPanel />
          <LinksPanel />
          <div className="lg:col-span-2">
            <SettingsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: "saved" | "saving" | "dirty" | "error" }) {
  const meta = {
    saved: { label: "Enregistré", color: "text-success" },
    saving: { label: "Enregistrement…", color: "text-content-muted" },
    dirty: { label: "Modifié", color: "text-warning" },
    error: { label: "Échec de l'enregistrement", color: "text-danger" },
  }[state];

  return (
    <span className={`text-xs ${meta.color}`} role="status">
      {meta.label}
    </span>
  );
}
