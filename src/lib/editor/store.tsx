"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api-client";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { parseThemeConfig } from "@/lib/schemas/theme";

/**
 * État partagé de l'éditeur.
 *
 * L'éditeur et l'aperçu lisent le même état : une modification dans un panneau
 * de réglage se reflète instantanément dans l'aperçu, sans aller-retour
 * réseau. La persistance est séparée du rendu : une modification marque
 * l'éditeur comme « Modifié », et la sauvegarde en base n'a lieu que sur le
 * bouton Enregistrer (ou les actions qui persistent immédiatement, comme la
 * publication).
 */

export type EditorLink = {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  position: number;
  isEnabled: boolean;
  clicks: number;
};

export type EditorBlock = {
  id: string;
  type: string;
  config: unknown;
  position: number;
  isEnabled: boolean;
};

export type EditorBiolink = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  isPublished: boolean;
  isPasswordProtected: boolean;
  /** Suspension de modération : publication verrouillée tant qu'elle est active. */
  suspendedUntil: string | null;
  suspensionReason: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  theme: ThemeConfig;
  links: EditorLink[];
  blocks: EditorBlock[];
  media: { id: string; type: string; url: string; key: string }[];
  owner: {
    username: string;
    discordId: string | null;
    discordUsername: string | null;
    discordAvatar: string | null;
    discordBanner: string | null;
    badges: string[];
  };
};

export type SaveState = "saved" | "saving" | "dirty" | "error";

type EditorContextValue = {
  biolink: EditorBiolink;
  saveState: SaveState;
  /** Met à jour le thème. */
  updateTheme: (updater: (theme: ThemeConfig) => ThemeConfig) => void;
  /** Met à jour un champ du biolink (titre, SEO…). */
  patchBiolink: (patch: Partial<Pick<EditorBiolink, "title" | "description" | "isPublished" | "seoTitle" | "seoDescription" | "ogImageUrl">>) => void;
  setLinks: (links: EditorLink[]) => void;
  setBlocks: (blocks: EditorBlock[]) => void;
  setMedia: (media: EditorBiolink["media"]) => void;
  /** Annule la dernière modification. */
  undo: () => void;
  /** Rétablit la dernière modification annulée. */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Sauvegarde immédiate des modifications en attente (bouton Enregistrer). */
  save: () => Promise<void>;
  /** Sauvegarde immédiate, pour les actions qui doivent persister sur-le-champ (publication). */
  flush: () => Promise<void>;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  initial,
  children,
}: {
  initial: EditorBiolink;
  children: ReactNode;
}) {
  const [biolink, setBiolink] = useState<EditorBiolink>(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Miroir synchrone du biolink : les mutations calculent le prochain état
  // depuis cette ref (au lieu d'une closure), ce qui permet de prendre un
  // snapshot d'historique fiable avant chaque modification — y compris quand
  // deux mutations se suivent dans le même rendu.
  const biolinkRef = useRef<EditorBiolink>(initial);

  // Historique d'annulation. Les snapshots sont de vrais clones : le biolink
  // contient des tableaux (links, blocks, media) et un objet theme imbriqué.
  const past = useRef<EditorBiolink[]>([]);
  const future = useRef<EditorBiolink[]>([]);
  const HISTORY_LIMIT = 50;

  // Dernier état réellement persisté en base : le PATCH est calculé comme la
  // différence entre l'état courant et cet état, ce qui rend undo/redo et
  // Enregistrer naturellement compatibles.
  const lastSaved = useRef<EditorBiolink>(cloneBiolink(initial));

  function cloneBiolink(value: EditorBiolink): EditorBiolink {
    return JSON.parse(JSON.stringify(value)) as EditorBiolink;
  }

  function commit(next: EditorBiolink) {
    biolinkRef.current = next;
    setBiolink(next);
  }

  function recordHistory() {
    past.current.push(cloneBiolink(biolinkRef.current));
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    // Une nouvelle modification invalide toutes les annulations futures.
    future.current = [];
    setCanUndo(past.current.length > 0);
    setCanRedo(false);
  }

  const persist = useCallback(async () => {
    const current = biolinkRef.current;
    const previous = lastSaved.current;

    // On ne PATCH le biolink que pour ses champs propres. Les liens et les
    // blocks ont leurs propres endpoints (ordre, config) : les inclure ici
    // dupliquerait la logique et risquerait des écritures contradictoires.
    const body: Record<string, unknown> = {};
    if (JSON.stringify(current.theme) !== JSON.stringify(previous.theme)) body.themeConfig = current.theme;
    if (current.title !== previous.title) body.title = current.title;
    if (current.description !== previous.description) body.description = current.description;
    if (current.isPublished !== previous.isPublished) body.isPublished = current.isPublished;
    if (current.seoTitle !== previous.seoTitle) body.seoTitle = current.seoTitle;
    if (current.seoDescription !== previous.seoDescription) body.seoDescription = current.seoDescription;
    if (current.ogImageUrl !== previous.ogImageUrl) body.ogImageUrl = current.ogImageUrl;
    // Liens et blocks : listes complètes. La comparaison par sérialisation
    // détecte aussi les réordonnancements, car l'ordre du tableau compte. Le
    // serveur réconcilie avec la base dans une transaction.
    if (JSON.stringify(current.links) !== JSON.stringify(previous.links)) {
      body.links = current.links;
    }
    if (JSON.stringify(current.blocks) !== JSON.stringify(previous.blocks)) {
      body.blocks = current.blocks;
    }

    if (Object.keys(body).length === 0) {
      setSaveState("saved");
      return;
    }

    setSaveState("saving");

    const result = await api.patch(`/api/biolinks/${current.id}`, body);
    if (result.ok) {
      lastSaved.current = cloneBiolink(biolinkRef.current);
      setSaveState("saved");
    } else {
      setSaveState("error");
    }
  }, []);

  // Plus d'enregistrement automatique : une modification marque simplement
  // l'éditeur comme « Modifié ». La sauvegarde en base n'a lieu que sur le
  // bouton Enregistrer (save) ou sur les actions qui doivent persister
  // immédiatement comme la publication (flush).
  const markDirty = useCallback(() => {
    setSaveState("dirty");
  }, []);

  const save = useCallback(async () => {
    await persist();
  }, [persist]);

  const flush = useCallback(async () => {
    await persist();
  }, [persist]);

  // Avertit avant de quitter si des modifications ne sont pas enregistrées :
  // l'enregistrement est manuel, un onglet fermé perdrait tout le travail.
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving") {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [saveState]);

  const updateTheme = useCallback(
    (updater: (theme: ThemeConfig) => ThemeConfig) => {
      recordHistory();
      const theme = parseThemeConfig(updater(biolinkRef.current.theme));
      commit({ ...biolinkRef.current, theme });
      markDirty();
    },
    [markDirty]
  );

  const patchBiolink = useCallback<EditorContextValue["patchBiolink"]>(
    (patch) => {
      recordHistory();
      commit({ ...biolinkRef.current, ...patch });
      markDirty();
    },
    [markDirty]
  );

  const setLinks = useCallback(
    (links: EditorLink[]) => {
      recordHistory();
      commit({ ...biolinkRef.current, links });
      markDirty();
    },
    [markDirty]
  );

  const setBlocks = useCallback(
    (blocks: EditorBlock[]) => {
      recordHistory();
      commit({ ...biolinkRef.current, blocks });
      markDirty();
    },
    [markDirty]
  );

  const setMedia = useCallback((media: EditorBiolink["media"]) => {
    recordHistory();
    commit({ ...biolinkRef.current, media });
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(cloneBiolink(biolinkRef.current));
    commit(previous);
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
    markDirty();
  }, [markDirty]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(cloneBiolink(biolinkRef.current));
    commit(next);
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
    markDirty();
  }, [markDirty]);

  return (
    <EditorContext.Provider
      value={{ biolink, saveState, updateTheme, patchBiolink, setLinks, setBlocks, setMedia, undo, redo, canUndo, canRedo, save, flush }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditor doit être utilisé dans un EditorProvider.");
  return context;
}
