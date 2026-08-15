"use client";

import { useState } from "react";
import Link from "next/link";
import { useEditor } from "@/lib/editor/store";
import { Button } from "@/components/ui/button";
import { AppearancePanel } from "@/components/editor/appearance-panel";
import { EffectsPanel } from "@/components/editor/effects-panel";
import { MusicPanel } from "@/components/editor/music-panel";
import { LinksPanel } from "@/components/editor/links-panel";
import { BlocksPanel } from "@/components/editor/blocks-panel";
import { SettingsPanel } from "@/components/editor/settings-panel";

type TabId = "blocks" | "links" | "appearance" | "effects" | "music" | "settings";

const TABS: { id: TabId; label: string; description: string }[] = [
  { id: "blocks", label: "Blocs", description: "Les sections de votre page : en-tête, avatar, texte, réseaux, intégrations…" },
  { id: "links", label: "Liens", description: "La liste de liens classique de votre bio, dans l'ordre de votre choix." },
  { id: "appearance", label: "Apparence", description: "Arrière-plan, couleurs, typographie, carte, avatar, bannière et mise en page." },
  { id: "effects", label: "Effets", description: "Curseur, particules, animations du texte, écran d'entrée et compteur de vues." },
  { id: "music", label: "Musique", description: "Le son de la page : audio de la vidéo de fond, pistes et lecteur." },
  { id: "settings", label: "Réglages", description: "Adresse, référencement et protection par mot de passe." },
];

/**
 * Coque de l'éditeur.
 *
 * Les réglages sont répartis en onglets logiques (contenu, apparence, effets,
 * musique, réglages) plutôt qu'en une seule longue liste. Sur grand écran, la
 * navigation est une colonne à gauche ; sur petit écran, elle devient une
 * barre d'onglets en bas de page, comme le panel admin.
 */
export function EditorShell() {
  const { biolink, saveState, patchBiolink, save, flush, undo, redo, canUndo, canRedo } = useEditor();
  const [active, setActive] = useState<TabId>("blocks");
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

  const activeTab = TABS.find((tab) => tab.id === active) ?? TABS[0];

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

      <div className="flex min-h-0 flex-1">
        {/* Navigation desktop : colonne latérale à gauche. */}
        <nav
          className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border-subtle p-3 lg:flex"
          aria-label="Sections de l'éditeur"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={active === tab.id ? "page" : undefined}
              className={[
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active === tab.id
                  ? "bg-surface-2 text-content-primary"
                  : "text-content-secondary hover:bg-surface-2 hover:text-content-primary",
              ].join(" ")}
            >
              <TabIcon id={tab.id} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Navigation mobile : barre d'onglets en bas de page, comme le panel admin. */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-1/95 backdrop-blur lg:hidden"
          aria-label="Sections de l'éditeur"
        >
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                aria-current={active === tab.id ? "page" : undefined}
                className={[
                  "flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-2 text-[10px] transition-colors",
                  active === tab.id ? "text-accent" : "text-content-muted",
                ].join(" ")}
              >
                <TabIcon id={tab.id} className="size-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
            <h1 className="text-lg font-semibold">{activeTab.label}</h1>
            <p className="mb-4 mt-0.5 text-xs text-content-muted">{activeTab.description}</p>
            {active === "blocks" && <BlocksPanel />}
            {active === "links" && <LinksPanel />}
            {active === "appearance" && <AppearancePanel />}
            {active === "effects" && <EffectsPanel />}
            {active === "music" && <MusicPanel />}
            {active === "settings" && <SettingsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabIcon({ id, className = "size-4" }: { id: TabId; className?: string }) {
  switch (id) {
    case "blocks":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
        </svg>
      );
    case "links":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z" />
        </svg>
      );
    case "appearance":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z" />
        </svg>
      );
    case "effects":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      );
  }
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
