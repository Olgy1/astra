"use client";

import { useEditor, type EditorBlock } from "@/lib/editor/store";
import {
  SelectControl,
  SliderControl,
  TextAreaControl,
  TextInputControl,
  ToggleControl,
} from "@/components/editor/controls";
import { SOCIAL_PLATFORMS } from "@/lib/blocks/definitions/socials";
import { SOCIAL_META } from "@/lib/socials";
import { fontChoices } from "@/lib/theme/fonts";

/**
 * Édition de la configuration d'un block.
 *
 * Les blocks ne servaient qu'à être ajoutés/supprimés : leur contenu (titre,
 * bio, texte, réseaux…) n'avait aucune interface. Ce composant couvre chaque
 * type du registry avec les réglages que son schéma expose. Chaque
 * modification est optimiste : l'aperçu (store) se met à jour d'abord, et la
 * sauvegarde n'a lieu qu'au clic sur Enregistrer — validée côté serveur par
 * le schéma du type (`validateBlockConfig`).
 *
 * `config` est typé lâchement ici : le vrai contrat est le schéma zod du type,
 * appliqué à l'écriture par l'API. Le parse au chargement garantit que les
 * valeurs affichées ont les bonnes formes.
 */
type Config = Record<string, unknown>;

export function BlockConfigForm({ block }: { block: EditorBlock }) {
  const { biolink, setBlocks } = useEditor();
  const config = (block.config ?? {}) as Config;

  function update(patch: Config) {
    const next = { ...config, ...patch };
    setBlocks(biolink.blocks.map((b) => (b.id === block.id ? { ...b, config: next } : b)));
  }

  function setField(key: string, value: unknown) {
    update({ [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-2 p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-content-muted">
        Réglages du block
      </p>

      {block.type === "avatar" && <AvatarForm config={config} setField={setField} />}
      {block.type === "badges" && <BadgesForm config={config} setField={setField} />}
      {block.type === "header" && <HeaderForm config={config} update={update} />}
      {block.type === "text" && <TextForm config={config} setField={setField} />}
      {block.type === "image" && <ImageForm config={config} setField={setField} />}
      {block.type === "divider" && <DividerForm config={config} setField={setField} />}
      {block.type === "links" && <LinksForm config={config} setField={setField} />}
      {block.type === "socials" && <SocialsForm config={config} update={update} />}
      {block.type === "cta_button" && <CtaForm config={config} setField={setField} />}
      {block.type === "video" && <VideoForm config={config} setField={setField} />}
      {block.type === "spotify" && <SpotifyForm config={config} setField={setField} />}
      {block.type === "reddit" && <RedditForm config={config} setField={setField} />}
      {block.type === "discord_server" && <DiscordServerForm config={config} setField={setField} />}
      {block.type === "discord_presence" && <DiscordPresenceForm config={config} setField={setField} />}
      {block.type === "visit_counter" && <VisitCounterForm config={config} setField={setField} />}
      {block.type === "countdown" && <CountdownForm config={config} setField={setField} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Petites aides                                                               */
/* -------------------------------------------------------------------------- */

function str(config: Config, key: string, fallback = ""): string {
  const value = config[key];
  return typeof value === "string" ? value : fallback;
}
function bool(config: Config, key: string, fallback = false): boolean {
  const value = config[key];
  return typeof value === "boolean" ? value : fallback;
}
function num(config: Config, key: string, fallback: number): number {
  const value = config[key];
  return typeof value === "number" ? value : fallback;
}

/** Ligne de saisie standard : libellé + champ texte + valeur actuelle. */
function Field({
  label,
  value,
  placeholder,
  type = "text",
  maxLength,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "url";
  maxLength?: number;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <TextInputControl label={label} value={value} placeholder={placeholder} maxLength={maxLength} onChange={onChange} />
      {hint && <p className="text-xs text-content-muted">{hint}</p>}
    </div>
  );
}

function urlOrEmpty(url?: string) {
  return url ? url : "";
}

/**
 * Sélection de la police d'un block.
 *
 * "inherit" (valeur vide) = suivre la police globale de la page. Les autres
 * choix sont le catalogue partagé, plus la police custom si l'utilisateur en
 * a uploadé une dans le thème. Écrire "inherit" retire la clé du config, ce
 * qui fait retomber le rendu sur la police de la page.
 */
function FontField({
  label = "Police",
  value,
  onChange,
  inheritAsUndefined = true,
}: {
  label?: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** « Police de la page » : écrire undefined (défaut) ou la chaîne « inherit ». */
  inheritAsUndefined?: boolean;
}) {
  const { biolink } = useEditor();
  const customFontUrl = biolink.theme.typography.customFontUrl;
  const current = value && value !== "inherit" ? value : "inherit";
  const options: { value: string; label: string }[] = [
    { value: "inherit", label: "Police de la page" },
    ...fontChoices(customFontUrl),
  ];

  return (
    <SelectControl
      label={label}
      value={current}
      options={options}
      onChange={(next) =>
        onChange(inheritAsUndefined && next === "inherit" ? undefined : next)
      }
    />
  );
}

/**
 * Valeur affichée d'une police de zone (titre, sous-titre, bio) : la police
 * spécifique si elle est posée, sinon la police par défaut du block.
 */
function zoneFontValue(config: Config, key: string): string | undefined {
  const specific = str(config, key);
  if (specific) return specific;
  return str(config, "fontFamily") || undefined;
}

/* -------------------------------------------------------------------------- */
/* Formulaires par type                                                        */
/* -------------------------------------------------------------------------- */

function AvatarForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Statut (texte sous l'avatar)" value={str(config, "statusText")} maxLength={40} placeholder="en ligne, en live…" onChange={(v) => setField("statusText", v || undefined)} />
      <Field label="Émoji du statut" value={str(config, "statusEmoji")} maxLength={8} placeholder="🟢" onChange={(v) => setField("statusEmoji", v || undefined)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
      <p className="text-xs text-content-muted">
        Les badges (vérifié, admin…) sont attribués par la plateforme : ajoutez le
        block « Badges » pour les afficher.
      </p>
    </>
  );
}

function BadgesForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <SelectControl label="Style" value={str(config, "style", "filled") as "filled" | "outlined"} options={[{ value: "filled", label: "Plein" }, { value: "outlined", label: "Contour" }]} onChange={(v) => setField("style", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
      <p className="text-xs text-content-muted">
        Les badges sont affichés en icône seule : le nom apparaît au survol.
        Ils sont attribués par les administrateurs de la plateforme (vérifié,
        admin…) — ce block ne fait que les afficher : retirez-le pour les
        masquer sur cette page.
      </p>
    </>
  );
}

function HeaderForm({ config, update }: { config: Config; update: (p: Config) => void }) {
  const badges = Array.isArray(config.badges) ? (config.badges as { label?: string; color?: string; icon?: string }[]) : [];

  return (
    <>
      <Field label="Titre" value={str(config, "title")} placeholder="Votre nom" onChange={(v) => update({ title: v || undefined })} hint="Vide = le titre de la page." />
      <Field label="Sous-titre" value={str(config, "subtitle")} placeholder="petite phrase" onChange={(v) => update({ subtitle: v || undefined })} />
      <TextAreaControl label="Bio" value={str(config, "bio")} rows={3} maxLength={500} onChange={(v) => update({ bio: v || undefined })} />
      <ToggleControl
        label="Bio avant le sous-titre"
        description="Par défaut le sous-titre s'affiche au-dessus de la bio ; activez pour inverser."
        checked={bool(config, "bioBeforeSubtitle")}
        onChange={(v) => update({ bioBeforeSubtitle: v })}
      />
      <ToggleControl label="Afficher @pseudo" checked={bool(config, "showUsername", true)} onChange={(v) => update({ showUsername: v })} />

      <FontField label="Police par défaut" value={str(config, "fontFamily") || undefined} onChange={(v) => update({ fontFamily: v })} />
      <FontField
        label="Police du titre"
        value={zoneFontValue(config, "titleFontFamily")}
        inheritAsUndefined={false}
        onChange={(v) => update({ titleFontFamily: v })}
      />
      <FontField
        label="Police du sous-titre"
        value={zoneFontValue(config, "subtitleFontFamily")}
        inheritAsUndefined={false}
        onChange={(v) => update({ subtitleFontFamily: v })}
      />
      <FontField
        label="Police de la bio"
        value={zoneFontValue(config, "bioFontFamily")}
        inheritAsUndefined={false}
        onChange={(v) => update({ bioFontFamily: v })}
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-content-secondary">Badges</p>
        {badges.map((badge, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={badge.label ?? ""}
              onChange={(event) => {
                const next = [...badges];
                next[index] = { ...next[index], label: event.target.value };
                update({ badges: next });
              }}
              placeholder="Libellé"
              className="w-full rounded-lg border border-border-subtle bg-surface-1 px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <input
              type="color"
              value={badge.color ?? "#8b5cf6"}
              onChange={(event) => {
                const next = [...badges];
                next[index] = { ...next[index], color: event.target.value };
                update({ badges: next });
              }}
              className="size-7 shrink-0 cursor-pointer rounded-lg border border-border-subtle bg-transparent"
            />
            <button
              type="button"
              onClick={() => update({ badges: badges.filter((_, i) => i !== index) })}
              className="shrink-0 text-content-muted transition-colors hover:text-danger"
              aria-label="Retirer le badge"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update({ badges: [...badges, { label: "Nouveau", color: "#8b5cf6" }] })}
          className="self-start rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent"
        >
          + Ajouter un badge
        </button>
      </div>
    </>
  );
}

function TextForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <TextAreaControl label="Contenu" value={str(config, "content")} rows={4} maxLength={2000} onChange={(v) => setField("content", v)} />
      <SelectControl label="Alignement" value={str(config, "align", "center") as "left" | "center" | "right"} options={[{ value: "left", label: "Gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "Droite" }]} onChange={(v) => setField("align", v)} />
      <SelectControl label="Taille" value={str(config, "size", "md") as "xs" | "sm" | "md" | "lg" | "xl"} options={[{ value: "xs", label: "Très petite" }, { value: "sm", label: "Petite" }, { value: "md", label: "Normale" }, { value: "lg", label: "Grande" }, { value: "xl", label: "Très grande" }]} onChange={(v) => setField("size", v)} />
      <ToggleControl label="Couleur d'accent" checked={bool(config, "useAccentColor")} onChange={(v) => setField("useAccentColor", v)} />
      <ToggleControl label="Gras" checked={bool(config, "bold")} onChange={(v) => setField("bold", v)} />
      <ToggleControl label="Italique" checked={bool(config, "italic")} onChange={(v) => setField("italic", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
    </>
  );
}

function ImageForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="URL de l'image" type="url" value={urlOrEmpty(str(config, "url"))} placeholder="https://" onChange={(v) => setField("url", v || undefined)} />
      <Field label="Texte alternatif" value={str(config, "alt")} onChange={(v) => setField("alt", v)} />
      <Field label="Lien au clic (optionnel)" type="url" value={urlOrEmpty(str(config, "linkUrl"))} placeholder="https://" onChange={(v) => setField("linkUrl", v || undefined)} />
      <SliderControl label="Arrondi" value={num(config, "borderRadius", 12)} min={0} max={48} unit="px" onChange={(v) => setField("borderRadius", v)} />
      <SelectControl label="Cadrage" value={str(config, "fit", "cover") as "cover" | "contain"} options={[{ value: "cover", label: "Remplir" }, { value: "contain", label: "Contenir" }]} onChange={(v) => setField("fit", v)} />
      <SliderControl label="Hauteur" value={num(config, "height", 300)} min={40} max={600} unit="px" onChange={(v) => setField("height", v)} />
    </>
  );
}

function DividerForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <SelectControl label="Style" value={str(config, "style", "line") as "line" | "dashed" | "dotted" | "gradient" | "space"} options={[{ value: "line", label: "Trait" }, { value: "dashed", label: "Tirets" }, { value: "dotted", label: "Pointillés" }, { value: "gradient", label: "Dégradé" }, { value: "space", label: "Espace" }]} onChange={(v) => setField("style", v)} />
      <Field label="Libellé (optionnel)" value={str(config, "label")} placeholder="Mes projets" onChange={(v) => setField("label", v || undefined)} />
      <SliderControl label="Épaisseur" value={num(config, "thickness", 1)} min={1} max={8} unit="px" onChange={(v) => setField("thickness", v)} />
      <SliderControl label="Espacement" value={num(config, "spacing", 16)} min={4} max={64} unit="px" onChange={(v) => setField("spacing", v)} />
      <SliderControl label="Opacité" value={num(config, "opacity", 0.3)} min={0} max={1} step={0.05} onChange={(v) => setField("opacity", v)} />
    </>
  );
}

function LinksForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  const range = (config.positionRange ?? {}) as { from?: number; to?: number };

  return (
    <>
      <SelectControl label="Disposition" value={str(config, "layout", "list") as "list" | "grid"} options={[{ value: "list", label: "Liste" }, { value: "grid", label: "Grille" }]} onChange={(v) => setField("layout", v)} />
      {str(config, "layout", "list") === "grid" && (
        <SliderControl label="Colonnes" value={num(config, "columns", 2)} min={2} max={4} onChange={(v) => setField("columns", v)} />
      )}
      <SelectControl label="Style des boutons" value={str(config, "buttonStyle", "solid") as "solid" | "outlined" | "ghost" | "neon"} options={[{ value: "solid", label: "Plein" }, { value: "outlined", label: "Contour" }, { value: "ghost", label: "Fantôme" }, { value: "neon", label: "Néon" }]} onChange={(v) => setField("buttonStyle", v)} />
      <SelectControl label="Effet au survol" value={str(config, "hoverEffect", "lift") as "none" | "lift" | "glow" | "shine" | "scale"} options={[{ value: "none", label: "Aucun" }, { value: "lift", label: "Lève" }, { value: "glow", label: "Lueur" }, { value: "shine", label: "Brille" }, { value: "scale", label: "Agrandit" }]} onChange={(v) => setField("hoverEffect", v)} />
      <ToggleControl label="Icônes des liens" checked={bool(config, "showIcons", true)} onChange={(v) => setField("showIcons", v)} />
      <ToggleControl label="Compter les clics" description="Affiche le nombre de clics à droite du lien." checked={bool(config, "showClickCount")} onChange={(v) => setField("showClickCount", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />

      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-content-secondary">Filtrer les liens affichés</p>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-xs text-content-muted">
            De
            <input
              type="number"
              min={0}
              value={range.from ?? ""}
              onChange={(event) => setField("positionRange", { ...range, from: event.target.value === "" ? undefined : Number(event.target.value) })}
              className="w-full rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent"
              placeholder="0"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-xs text-content-muted">
            À
            <input
              type="number"
              min={0}
              value={range.to ?? ""}
              onChange={(event) => setField("positionRange", { ...range, to: event.target.value === "" ? undefined : Number(event.target.value) })}
              className="w-full rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent"
              placeholder="∞"
            />
          </label>
        </div>
        <p className="text-xs text-content-muted">Permet de découper vos liens en plusieurs sections (ex. « réseaux » puis « projets »).</p>
      </div>
    </>
  );
}

function SocialsForm({ config, update }: { config: Config; update: (p: Config) => void }) {
  const entries = Array.isArray(config.entries)
    ? (config.entries as { platform: string; value: string; newTab?: boolean }[])
    : [];

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-content-secondary">Réseaux</p>
        {entries.length === 0 && (
          <p className="text-xs text-content-muted">Aucun réseau : ajoutez-en un ci-dessous.</p>
        )}
        {entries.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <select
              value={SOCIAL_PLATFORMS.includes(entry.platform as never) ? entry.platform : "website"}
              onChange={(event) => {
                const next = [...entries];
                next[index] = { ...next[index], platform: event.target.value };
                update({ entries: next });
              }}
              className="w-28 shrink-0 rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              {SOCIAL_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {SOCIAL_META[platform].label}
                </option>
              ))}
            </select>
            <input
              value={entry.value}
              onChange={(event) => {
                const next = [...entries];
                next[index] = { ...next[index], value: event.target.value };
                update({ entries: next });
              }}
              placeholder="@pseudo ou URL"
              className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => update({ entries: entries.filter((_, i) => i !== index) })}
              className="shrink-0 text-content-muted transition-colors hover:text-danger"
              aria-label="Retirer le réseau"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update({ entries: [...entries, { platform: "instagram", value: "", newTab: true }] })}
          className="self-start rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent"
        >
          + Ajouter un réseau
        </button>
      </div>

      <SliderControl label="Taille des icônes" value={num(config, "iconSize", 28)} min={16} max={64} unit="px" onChange={(v) => update({ iconSize: v })} />
      <SliderControl label="Espacement" value={num(config, "gap", 12)} min={4} max={32} unit="px" onChange={(v) => update({ gap: v })} />
      <SelectControl label="Style" value={str(config, "style", "plain") as "plain" | "filled" | "outlined"} options={[{ value: "plain", label: "Simple" }, { value: "filled", label: "Plein" }, { value: "outlined", label: "Contour" }]} onChange={(v) => update({ style: v })} />
      <ToggleControl label="Couleurs de la marque" checked={bool(config, "useBrandColors")} onChange={(v) => update({ useBrandColors: v })} />
      <SelectControl label="Effet au survol" value={str(config, "hoverEffect", "lift") as "none" | "lift" | "glow" | "bounce"} options={[{ value: "none", label: "Aucun" }, { value: "lift", label: "Lève" }, { value: "glow", label: "Lueur" }, { value: "bounce", label: "Rebondit" }]} onChange={(v) => update({ hoverEffect: v })} />
    </>
  );
}

function CtaForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Texte du bouton" value={str(config, "label", "Cliquez ici")} onChange={(v) => setField("label", v)} />
      <Field label="Lien" type="url" value={urlOrEmpty(str(config, "url"))} placeholder="https://" onChange={(v) => setField("url", v || undefined)} />
      <SelectControl label="Style" value={str(config, "variant", "primary") as "primary" | "secondary" | "outline" | "gradient"} options={[{ value: "primary", label: "Principal" }, { value: "secondary", label: "Secondaire" }, { value: "outline", label: "Contour" }, { value: "gradient", label: "Dégradé" }]} onChange={(v) => setField("variant", v)} />
      <SelectControl label="Taille" value={str(config, "size", "md") as "sm" | "md" | "lg"} options={[{ value: "sm", label: "Petite" }, { value: "md", label: "Normale" }, { value: "lg", label: "Grande" }]} onChange={(v) => setField("size", v)} />
      <ToggleControl label="Pleine largeur" checked={bool(config, "fullWidth", true)} onChange={(v) => setField("fullWidth", v)} />
      <ToggleControl label="Animation d'appel" checked={bool(config, "pulse")} onChange={(v) => setField("pulse", v)} />
      <ToggleControl label="Nouvel onglet" checked={bool(config, "newTab", true)} onChange={(v) => setField("newTab", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
    </>
  );
}

function VideoForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  const platform = str(config, "platform", "youtube");
  return (
    <>
      <SelectControl label="Plateforme" value={platform as "youtube" | "twitch_channel" | "twitch_video"} options={[{ value: "youtube", label: "YouTube" }, { value: "twitch_channel", label: "Twitch — chaîne" }, { value: "twitch_video", label: "Twitch — VOD" }]} onChange={(v) => setField("platform", v)} />
      <Field
        label="Identifiant"
        value={str(config, "entityId")}
        placeholder={platform === "youtube" ? "dQw4w9WgXcQ" : platform === "twitch_channel" ? "nom_de_chaîne" : "1234567890"}
        hint={platform === "youtube" ? "Les 11 caractères de l'ID vidéo." : platform === "twitch_channel" ? "Le nom de la chaîne." : "L'ID de la VOD."}
        onChange={(v) => setField("entityId", v || undefined)}
      />
      <ToggleControl label="Lecture auto" checked={bool(config, "autoplay")} onChange={(v) => setField("autoplay", v)} />
      <ToggleControl label="Charger au clic" description="Ne charge le lecteur que lorsqu'on clique sur la vignette." checked={bool(config, "lazyLoad", true)} onChange={(v) => setField("lazyLoad", v)} />
      <SelectControl label="Format" value={str(config, "aspectRatio", "16:9") as "16:9" | "4:3" | "1:1" | "9:16"} options={[{ value: "16:9", label: "16:9" }, { value: "4:3", label: "4:3" }, { value: "1:1", label: "Carré" }, { value: "9:16", label: "9:16 vertical" }]} onChange={(v) => setField("aspectRatio", v)} />
    </>
  );
}

function SpotifyForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <SelectControl label="Type" value={str(config, "entityType", "track") as "track" | "album" | "playlist" | "artist"} options={[{ value: "track", label: "Titre" }, { value: "album", label: "Album" }, { value: "playlist", label: "Playlist" }, { value: "artist", label: "Artiste" }]} onChange={(v) => setField("entityType", v)} />
      <Field label="Identifiant Spotify" value={str(config, "entityId")} placeholder="22 caractères" onChange={(v) => setField("entityId", v || undefined)} hint="Exemple : depuis l'URL « open.spotify.com/track/… »." />
      <SelectControl label="Thème" value={str(config, "theme", "dark") as "dark" | "light"} options={[{ value: "dark", label: "Sombre" }, { value: "light", label: "Clair" }]} onChange={(v) => setField("theme", v)} />
      <ToggleControl label="Compact" checked={bool(config, "compact")} onChange={(v) => setField("compact", v)} />
    </>
  );
}

function RedditForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  const mode = str(config, "mode", "subreddit");
  return (
    <>
      <SelectControl label="Mode" value={mode as "subreddit" | "post"} options={[{ value: "subreddit", label: "Subreddit" }, { value: "post", label: "Post précis" }]} onChange={(v) => setField("mode", v)} />
      {mode === "subreddit" ? (
        <>
          <Field label="Subreddit" value={str(config, "subreddit")} placeholder="programming" onChange={(v) => setField("subreddit", v || undefined)} />
          <SliderControl label="Nombre de posts" value={num(config, "limit", 3)} min={1} max={10} onChange={(v) => setField("limit", v)} />
        </>
      ) : (
        <Field label="Identifiant du post" value={str(config, "postId")} placeholder="t3_abc123" onChange={(v) => setField("postId", v || undefined)} />
      )}
    </>
  );
}

function DiscordServerForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Code d'invitation" value={str(config, "inviteCode")} placeholder="abc123" onChange={(v) => setField("inviteCode", v || undefined)} hint="Le code seul, pas l'URL complète : « discord.gg/abc123 » → « abc123 »." />
      <Field label="Texte du bouton" value={str(config, "buttonLabel", "Rejoindre")} onChange={(v) => setField("buttonLabel", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
    </>
  );
}

function DiscordPresenceForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <ToggleControl label="Activité en cours" checked={bool(config, "showActivity", true)} onChange={(v) => setField("showActivity", v)} />
      <ToggleControl label="Spotify" checked={bool(config, "showSpotify", true)} onChange={(v) => setField("showSpotify", v)} />
      <ToggleControl label="Grande image" checked={bool(config, "showLargeImage", true)} onChange={(v) => setField("showLargeImage", v)} />
      <ToggleControl label="Compact" checked={bool(config, "compact")} onChange={(v) => setField("compact", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
    </>
  );
}

function VisitCounterForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Libellé" value={str(config, "label", "vues")} onChange={(v) => setField("label", v)} />
      <SelectControl label="Style" value={str(config, "style", "badge") as "inline" | "badge" | "card"} options={[{ value: "inline", label: "En ligne" }, { value: "badge", label: "Pastille" }, { value: "card", label: "Carte" }]} onChange={(v) => setField("style", v)} />
      <ToggleControl label="Compte animé" checked={bool(config, "animateOnLoad", true)} onChange={(v) => setField("animateOnLoad", v)} />
      <ToggleControl label="Notation compacte" description="1 234 567 → « 1,2 M »" checked={bool(config, "compactNotation")} onChange={(v) => setField("compactNotation", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
    </>
  );
}

function CountdownForm({ config, setField }: { config: Config; setField: (k: string, v: unknown) => void }) {
  const target = str(config, "targetDate");
  return (
    <>
      <Field
        label="Date cible"
        value={target}
        placeholder="2026-12-25T00:00:00Z"
        onChange={(v) => setField("targetDate", v || undefined)}
        hint="Format ISO : « 2026-12-25T00:00:00Z »."
      />
      <Field label="Titre (optionnel)" value={str(config, "title")} placeholder="Sortie du projet" onChange={(v) => setField("title", v || undefined)} />
      <Field label="Texte une fois expiré" value={str(config, "expiredText", "C'est parti !")} onChange={(v) => setField("expiredText", v)} />
      <SelectControl label="Style" value={str(config, "style", "boxes") as "boxes" | "inline" | "minimal"} options={[{ value: "boxes", label: "Boîtes" }, { value: "inline", label: "En ligne" }, { value: "minimal", label: "Minimal" }]} onChange={(v) => setField("style", v)} />
      <ToggleControl label="Jours" checked={bool(config, "showDays", true)} onChange={(v) => setField("showDays", v)} />
      <ToggleControl label="Heures" checked={bool(config, "showHours", true)} onChange={(v) => setField("showHours", v)} />
      <ToggleControl label="Minutes" checked={bool(config, "showMinutes", true)} onChange={(v) => setField("showMinutes", v)} />
      <ToggleControl label="Secondes" checked={bool(config, "showSeconds", true)} onChange={(v) => setField("showSeconds", v)} />
      <FontField value={str(config, "fontFamily") || undefined} onChange={(v) => setField("fontFamily", v)} />
    </>
  );
}
