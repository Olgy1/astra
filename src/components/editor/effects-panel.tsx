"use client";

import { useEditor } from "@/lib/editor/store";
import {
  ColorControl,
  ControlGroup,
  SelectControl,
  SliderControl,
  TextInputControl,
  ToggleControl,
} from "@/components/editor/controls";
import { MediaUpload } from "@/components/editor/media-upload";
import { fontChoices, fontCredit } from "@/lib/theme/fonts";

/**
 * Effets et animations de la page.
 *
 * Chaque groupe couvre une fonction précise — curseur, particules, inclinaison
 * 3D, animations du texte, entrée de page, compteur de vues — plutôt qu'un
 * seul fourre-tout « Animations ». Séparé de l'apparence (couleurs, carte,
 * avatar) : tout ce qui « bouge » ou interagit est regroupé ici.
 */
export function EffectsPanel() {
  const { biolink, updateTheme, setMedia } = useEditor();
  const { theme } = biolink;

  /** Remplace le média d'un type donné dans le store (pour l'aperçu live). */
  function replaceMedia(type: string, asset: { id: string; url: string; key: string }) {
    const others = biolink.media.filter((m) => m.type !== type);
    setMedia([{ id: asset.id, type, url: asset.url, key: asset.key }, ...others]);
  }

  return (
    <div className="flex flex-col">
      <ControlGroup title="Curseur">
        <ToggleControl label="Curseur personnalisé" checked={theme.cursor.enabled} onChange={(v) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, enabled: v } }))} />
        {theme.cursor.enabled && (
          <>
            <MediaUpload
              type="CURSOR"
              currentUrl={theme.cursor.url}
              onUploaded={(asset) => { replaceMedia("CURSOR", asset); updateTheme((c) => ({ ...c, cursor: { ...c.cursor, url: asset.url } })); }}
              onCleared={() => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, url: undefined } }))}
            />
            <SliderControl label="Point actif horizontal" value={theme.cursor.hotspotX} min={0} max={64} unit="px" onChange={(hotspotX) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, hotspotX } }))} />
            <SliderControl label="Point actif vertical" value={theme.cursor.hotspotY} min={0} max={64} unit="px" onChange={(hotspotY) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, hotspotY } }))} />
            <ToggleControl label="Traînée" description="Particules qui suivent le curseur." checked={theme.cursor.trailEnabled} onChange={(trailEnabled) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, trailEnabled } }))} />
            {theme.cursor.trailEnabled && (
              <>
                <SelectControl label="Type de traînée" value={theme.cursor.trailKind} options={[{ value: "sparkles", label: "Étincelles" }, { value: "stars", label: "Étoiles" }, { value: "snow", label: "Neige" }, { value: "dust", label: "Poussière lumineuse" }, { value: "bubbles", label: "Bulles" }]} onChange={(trailKind) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, trailKind } }))} />
                <ColorControl label="Couleur de la traînée" value={theme.cursor.trailColor} onChange={(trailColor) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, trailColor } }))} />
              </>
            )}
          </>
        )}
      </ControlGroup>

      <ControlGroup title="Particules">
        <ToggleControl label="Particules d'arrière-plan" description="Flottent derrière la carte." checked={theme.effects.particles.enabled} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, enabled: v } } }))} />
        {theme.effects.particles.enabled && (
          <>
            <SelectControl label="Type" value={theme.effects.particles.kind} options={[{ value: "stars", label: "Étoiles" }, { value: "snow", label: "Neige" }, { value: "bubbles", label: "Bulles" }, { value: "confetti", label: "Confettis" }, { value: "rain", label: "Pluie" }]} onChange={(kind) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, kind } } }))} />
            <ColorControl label="Couleur" value={theme.effects.particles.color} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, color: v } } }))} />
            <SliderControl label="Quantité" value={theme.effects.particles.count} min={5} max={200} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, count: v } } }))} />
            <SliderControl label="Vitesse" value={theme.effects.particles.speed} min={0.1} max={5} step={0.1} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, speed: v } } }))} />
          </>
        )}
      </ControlGroup>

      <ControlGroup title="Inclinaison 3D">
        <ToggleControl label="Inclinaison 3D au survol" checked={theme.effects.tiltEnabled} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tiltEnabled: v } }))} />
        {theme.effects.tiltEnabled && (
          <SliderControl label="Intensité de l'inclinaison" value={theme.effects.tiltIntensity} min={1} max={25} onChange={(tiltIntensity) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tiltIntensity } }))} />
        )}
      </ControlGroup>

      <ControlGroup title="Animations du texte">
        <SelectControl label="Animation du titre" value={theme.effects.titleAnimation} options={[{ value: "none", label: "Aucune" }, { value: "typewriter", label: "Machine à écrire" }, { value: "glitch", label: "Glitch" }, { value: "fade", label: "Fondu" }, { value: "sparkle", label: "Scintillement" }, { value: "wave", label: "Vague" }]} onChange={(titleAnimation) => updateTheme((c) => ({ ...c, effects: { ...c.effects, titleAnimation } }))} />
        <ToggleControl
          label="Animer le titre de l'onglet"
          description="Anime le titre dans l'onglet du navigateur (le pseudo uniquement)."
          checked={theme.effects.tabTitleTypewriter}
          onChange={(tabTitleTypewriter) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tabTitleTypewriter } }))}
        />
        {theme.effects.tabTitleTypewriter && (
          <>
            <SelectControl
              label="Style de l'onglet"
              value={theme.effects.tabTitleStyle}
              options={[
                { value: "typewriter", label: "Machine à écrire" },
                { value: "marquee", label: "Défilement continu" },
              ]}
              onChange={(tabTitleStyle) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tabTitleStyle } }))}
            />
            {theme.effects.tabTitleStyle === "marquee" && (
              <SelectControl
                label="Sens du défilement"
                value={theme.effects.tabTitleDirection}
                options={[
                  { value: "left", label: "Vers la gauche" },
                  { value: "right", label: "Vers la droite" },
                ]}
                onChange={(tabTitleDirection) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tabTitleDirection } }))}
              />
            )}
            <SliderControl label="Vitesse de l'onglet" value={theme.effects.tabTitleSpeed} min={1} max={300} unit="ms" onChange={(tabTitleSpeed) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tabTitleSpeed } }))} />
          </>
        )}
      </ControlGroup>

      <ControlGroup title="Entrée de page">
        <SelectControl label="Animation d'entrée" value={theme.effects.entranceAnimation} options={[{ value: "none", label: "Aucune" }, { value: "fade", label: "Fondu" }, { value: "slide-up", label: "Glissement" }, { value: "zoom", label: "Zoom" }]} onChange={(entranceAnimation) => updateTheme((c) => ({ ...c, effects: { ...c.effects, entranceAnimation } }))} />
        <ToggleControl
          label="Écran cliquable au début"
          description="Un voile « cliquez pour entrer » avant la page."
          checked={theme.entranceScreen.enabled}
          onChange={(v) => updateTheme((c) => ({ ...c, entranceScreen: { ...c.entranceScreen, enabled: v } }))}
        />
        {theme.entranceScreen.enabled && (
          <>
            <TextInputControl
              label="Texte affiché"
              value={theme.entranceScreen.text}
              placeholder="cliquez pour entrer"
              maxLength={60}
              onChange={(text) => updateTheme((c) => ({ ...c, entranceScreen: { ...c.entranceScreen, text } }))}
            />
            <SelectControl
              label="Police"
              value={theme.entranceScreen.fontFamily}
              options={fontChoices(theme.typography.customFontUrl, theme.typography.customFontName)}
              onChange={(fontFamily) => updateTheme((c) => ({ ...c, entranceScreen: { ...c.entranceScreen, fontFamily } }))}
              credit={fontCredit(theme.entranceScreen.fontFamily)}
            />
            <SliderControl label="Flou de l'écran" value={theme.entranceScreen.blurAmount} min={0} max={40} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, entranceScreen: { ...c.entranceScreen, blurAmount: v } }))} />
          </>
        )}
        {(theme.audio.enabled || (theme.background.kind === "video" && theme.background.useVideoAudio)) && (
          <p className="text-xs text-content-muted">
            Les navigateurs bloquent l&apos;audio tant que le visiteur n&apos;a pas interagi avec la page. Le bouton de volume (dans le lecteur, ou en haut à gauche) permet de réactiver le son.
          </p>
        )}
      </ControlGroup>

      <ControlGroup title="Compteur de vues">
        <p className="text-xs text-content-muted">
          Toujours affiché dans un coin de la carte.
        </p>
        <SelectControl
          label="Coin"
          value={theme.viewCounter.position}
          options={[
            { value: "top-left", label: "Haut gauche" },
            { value: "top-right", label: "Haut droite" },
            { value: "bottom-left", label: "Bas gauche" },
            { value: "bottom-right", label: "Bas droite" },
            { value: "bottom-center", label: "Bas centre" },
          ]}
          onChange={(position) => updateTheme((c) => ({ ...c, viewCounter: { ...c.viewCounter, position } }))}
        />
        <ToggleControl label="Notation compacte" description="1 234 567 → « 1,2 M »" checked={theme.viewCounter.compact} onChange={(compact) => updateTheme((c) => ({ ...c, viewCounter: { ...c.viewCounter, compact } }))} />
        <SelectControl
          label="Police"
          value={theme.viewCounter.fontFamily}
          options={[
            { value: "inherit", label: "Police de la page" },
            ...fontChoices(theme.typography.customFontUrl, theme.typography.customFontName),
          ]}
          onChange={(fontFamily) => updateTheme((c) => ({ ...c, viewCounter: { ...c.viewCounter, fontFamily } }))}
          credit={fontCredit(theme.viewCounter.fontFamily)}
        />
      </ControlGroup>
    </div>
  );
}
