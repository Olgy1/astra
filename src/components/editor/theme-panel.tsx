"use client";

import { useState } from "react";
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
import { AvatarCropModal } from "@/components/editor/avatar-crop";
import { THEME_PRESETS } from "@/lib/theme/presets";
import { fontChoices } from "@/lib/theme/fonts";

/**
 * Panneau de personnalisation du thème.
 *
 * Expose l'intégralité de `themeConfig` : arrière-plan (couleur, dégradé,
 * image ou vidéo uploadée), texte et effets néon, carte, avatar, effets,
 * curseur personnalisé, musique. Chaque contrôle mute le thème de façon
 * immuable ; l'aperçu se recalcule et la sauvegarde est planifiée.
 */
export function ThemePanel() {
  const { biolink, updateTheme, setMedia } = useEditor();
  const { theme } = biolink;
  const [cropping, setCropping] = useState(false);

  const avatarUrl = biolink.media.find((m) => m.type === "AVATAR")?.url;

  /** Remplace le média d'un type donné dans le store (pour l'aperçu live). */
  function replaceMedia(type: string, asset: { id: string; url: string; key: string }) {
    const others = biolink.media.filter((m) => m.type !== type);
    setMedia([{ id: asset.id, type, url: asset.url, key: asset.key }, ...others]);
  }

  return (
    <div className="flex flex-col">
      <ControlGroup title="Thèmes prédéfinis">
        <p className="text-xs text-content-muted">Applique une base visuelle en un clic. Vos réglages (curseur, musique, écran d&apos;entrée…) sont conservés.</p>
        <ul className="grid grid-cols-3 gap-2">
          {THEME_PRESETS.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                onClick={() => updateTheme(() => preset.apply())}
                className="w-full rounded-xl border border-border-subtle bg-surface-1 p-2 text-center transition-colors hover:border-accent"
                title={`Appliquer « ${preset.name} »`}
              >
                <span
                  className="block h-10 w-full rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${preset.swatch[0]} 50%, ${preset.swatch[1]} 50%)` }}
                />
                <span className="mt-1.5 block text-xs font-medium">{preset.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </ControlGroup>

      <ControlGroup title="Arrière-plan">
        <SelectControl
          label="Type"
          value={theme.background.kind}
          options={[
            { value: "solid", label: "Couleur unie" },
            { value: "gradient", label: "Dégradé" },
            { value: "image", label: "Image" },
            { value: "video", label: "Vidéo" },
          ]}
          onChange={(kind) =>
            updateTheme((current) => {
              const base =
                kind === "solid"
                  ? { kind: "solid" as const, color: "#0a0a0f" }
                  : kind === "gradient"
                    ? { kind: "gradient" as const, type: "linear" as const, angle: 180, stops: [{ color: "#1a0b2e", at: 0 }, { color: "#0a0a1f", at: 100 }] }
                    : kind === "image"
                      ? { kind: "image" as const, url: "https://placehold.co/1080x1920", fit: "cover" as const, blur: 0, dim: 0.3 }
                      : { kind: "video" as const, url: "https://placehold.co/1080x1920", blur: 0, dim: 0.4, muted: true, useVideoAudio: false, volume: 0.5 };
              return { ...current, background: base };
            })
          }
        />

        {theme.background.kind === "solid" && (
          <ColorControl label="Couleur" value={theme.background.color} onChange={(color) => updateTheme((c) => ({ ...c, background: { kind: "solid", color } }))} />
        )}

        {theme.background.kind === "gradient" && (
          <>
            <ColorControl label="Couleur 1" value={theme.background.stops[0]?.color ?? "#000000"} onChange={(color) => updateTheme((c) => { if (c.background.kind !== "gradient") return c; const stops = [...c.background.stops]; stops[0] = { color, at: stops[0]?.at ?? 0 }; return { ...c, background: { ...c.background, stops } }; })} />
            <ColorControl label="Couleur 2" value={theme.background.stops[1]?.color ?? "#000000"} onChange={(color) => updateTheme((c) => { if (c.background.kind !== "gradient") return c; const stops = [...c.background.stops]; stops[1] = { color, at: stops[1]?.at ?? 100 }; return { ...c, background: { ...c.background, stops } }; })} />
            <SliderControl label="Angle" value={theme.background.angle} min={0} max={360} unit="°" onChange={(angle) => updateTheme((c) => (c.background.kind === "gradient" ? { ...c, background: { ...c.background, angle } } : c))} />
            <SelectControl label="Forme" value={theme.background.type} options={[{ value: "linear", label: "Linéaire" }, { value: "radial", label: "Radial" }, { value: "conic", label: "Conique" }]} onChange={(type) => updateTheme((c) => (c.background.kind === "gradient" ? { ...c, background: { ...c.background, type } } : c))} />
          </>
        )}

        {theme.background.kind === "image" && (
          <>
            <MediaUpload
              type="BACKGROUND"
              currentUrl={theme.background.url.startsWith("http") && !theme.background.url.includes("placehold") ? theme.background.url : undefined}
              onUploaded={(asset) => { replaceMedia("BACKGROUND", asset); updateTheme((c) => (c.background.kind === "image" ? { ...c, background: { ...c.background, url: asset.url } } : c)); }}
            />
            <SliderControl label="Flou" value={theme.background.blur} min={0} max={40} unit="px" onChange={(blur) => updateTheme((c) => (c.background.kind === "image" ? { ...c, background: { ...c.background, blur } } : c))} />
            <SliderControl label="Assombrir" value={theme.background.dim} min={0} max={1} step={0.05} onChange={(dim) => updateTheme((c) => (c.background.kind === "image" ? { ...c, background: { ...c.background, dim } } : c))} />
            <SelectControl label="Cadrage" value={theme.background.fit} options={[{ value: "cover", label: "Remplir" }, { value: "contain", label: "Contenir" }, { value: "tile", label: "Répéter" }]} onChange={(fit) => updateTheme((c) => (c.background.kind === "image" ? { ...c, background: { ...c.background, fit } } : c))} />
          </>
        )}

        {theme.background.kind === "video" && (
          <>
            <MediaUpload
              type="BACKGROUND"
              currentUrl={theme.background.url.startsWith("http") && !theme.background.url.includes("placehold") ? theme.background.url : undefined}
              onUploaded={(asset) => { replaceMedia("BACKGROUND", asset); updateTheme((c) => (c.background.kind === "video" ? { ...c, background: { ...c.background, url: asset.url } } : c)); }}
            />
            <SliderControl label="Flou" value={theme.background.blur} min={0} max={40} unit="px" onChange={(blur) => updateTheme((c) => (c.background.kind === "video" ? { ...c, background: { ...c.background, blur } } : c))} />
            <SliderControl label="Assombrir" value={theme.background.dim} min={0} max={1} step={0.05} onChange={(dim) => updateTheme((c) => (c.background.kind === "video" ? { ...c, background: { ...c.background, dim } } : c))} />
            {/* Le réglage du son de la vidéo vit dans l'onglet Musique : c'est
                une question de son, pas d'arrière-plan. */}
          </>
        )}
      </ControlGroup>

      <ControlGroup title="Texte">
        <ColorControl label="Couleur" value={theme.typography.textColor} onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, textColor: v } }))} />
        <ColorControl label="Accent" value={theme.typography.accentColor} onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, accentColor: v } }))} />
        <ColorControl label="Texte secondaire" value={theme.typography.mutedColor} onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, mutedColor: v } }))} />
        <SliderControl label="Taille" value={theme.typography.fontSize} min={12} max={24} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, fontSize: v } }))} />
        <SliderControl label="Espacement" value={theme.typography.letterSpacing} min={-2} max={8} step={0.5} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, letterSpacing: v } }))} />
        <SelectControl label="Police" value={theme.typography.fontFamily} options={[{ value: "Inter", label: "Inter" }, { value: "Poppins", label: "Poppins" }, { value: "Montserrat", label: "Montserrat" }, { value: "JetBrains Mono", label: "Mono" }, { value: "Playfair Display", label: "Serif" }, ...(theme.typography.customFontUrl ? [{ value: "custom", label: "Personnalisée" }] : [])]} onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, fontFamily: v } }))} />
        <MediaUpload
          type="FONT"
          currentUrl={theme.typography.customFontUrl}
          onUploaded={(asset) => updateTheme((c) => ({ ...c, typography: { ...c.typography, customFontUrl: asset.url, fontFamily: "custom" } }))}
          onCleared={() => updateTheme((c) => ({ ...c, typography: { ...c.typography, customFontUrl: undefined, fontFamily: c.typography.fontFamily === "custom" ? "Inter" : c.typography.fontFamily } }))}
        />
        <ToggleControl label="Titre en dégradé animé" checked={theme.typography.titleGradient} onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, titleGradient: v } }))} />
        <ToggleControl label="Halo néon sur le texte" checked={theme.typography.textGlow} onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, textGlow: v } }))} />
        {theme.typography.textGlow && (
          <>
            <ColorControl label="Couleur du halo" value={theme.typography.textGlowColor} onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, textGlowColor: v } }))} />
            <SliderControl label="Intensité du halo" value={theme.typography.textGlowIntensity} min={0} max={30} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, typography: { ...c.typography, textGlowIntensity: v } }))} />
          </>
        )}
      </ControlGroup>

      <ControlGroup title="Carte">
        <ColorControl label="Fond" value={theme.card.backgroundColor} onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, backgroundColor: v } }))} />
        <SliderControl label="Opacité" value={theme.card.opacity} min={0} max={1} step={0.05} onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, opacity: v } }))} />
        <SliderControl label="Flou du fond" value={theme.card.blur} min={0} max={40} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, blur: v } }))} />
        <SliderControl label="Arrondi" value={theme.card.borderRadius} min={0} max={48} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, borderRadius: v } }))} />
        <SliderControl label="Bordure" value={theme.card.borderWidth} min={0} max={8} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, borderWidth: v } }))} />
        <ColorControl label="Couleur bordure" value={theme.card.borderColor} onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, borderColor: v } }))} />
        <SliderControl label="Ombre" value={theme.card.shadowSize} min={0} max={64} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, shadowSize: v } }))} />
        <ToggleControl label="Lueur colorée" checked={theme.card.glowEnabled} onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, glowEnabled: v } }))} />
        {theme.card.glowEnabled && <ColorControl label="Couleur lueur" value={theme.card.glowColor} onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, glowColor: v } }))} />}
        <ToggleControl label="Bordure animée" checked={theme.card.animatedBorder} onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, animatedBorder: v } }))} />
        {theme.card.animatedBorder && <ColorControl label="Couleur bordure animée" value={theme.card.animatedBorderColor} onChange={(v) => updateTheme((c) => ({ ...c, card: { ...c.card, animatedBorderColor: v } }))} />}
      </ControlGroup>

      <ControlGroup title="Avatar">
        <MediaUpload
          type="AVATAR"
          currentUrl={avatarUrl}
          onUploaded={(asset) => replaceMedia("AVATAR", asset)}
          onCleared={() => setMedia(biolink.media.filter((m) => m.type !== "AVATAR"))}
        />
        {avatarUrl && (
          <button
            type="button"
            onClick={() => setCropping(true)}
            className="self-start rounded-lg border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent"
          >
            Rogner l&apos;image
          </button>
        )}
        {cropping && avatarUrl && (
          <AvatarCropModal
            imageUrl={avatarUrl}
            onClose={() => setCropping(false)}
            onApplied={(asset) => replaceMedia("AVATAR", asset)}
          />
        )}
        {biolink.owner.discordAvatar && (
          <ToggleControl
            label="Utiliser l'avatar Discord"
            description="Priorité à l'avatar du compte Discord lié, même si une photo est uploadée."
            checked={theme.avatar.useDiscord}
            onChange={(useDiscord) => updateTheme((c) => ({ ...c, avatar: { ...c.avatar, useDiscord } }))}
          />
        )}
        <SelectControl label="Forme" value={theme.avatar.shape} options={[{ value: "circle", label: "Rond" }, { value: "rounded", label: "Arrondi" }, { value: "square", label: "Carré" }]} onChange={(shape) => updateTheme((c) => ({ ...c, avatar: { ...c.avatar, shape } }))} />
        <SliderControl label="Taille" value={theme.avatar.size} min={48} max={200} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, avatar: { ...c.avatar, size: v } }))} />
        <SliderControl label="Bordure" value={theme.avatar.borderWidth} min={0} max={8} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, avatar: { ...c.avatar, borderWidth: v } }))} />
        <ColorControl label="Couleur bordure" value={theme.avatar.borderColor} onChange={(v) => updateTheme((c) => ({ ...c, avatar: { ...c.avatar, borderColor: v } }))} />
        <ToggleControl label="Lueur" checked={theme.avatar.glowEnabled} onChange={(v) => updateTheme((c) => ({ ...c, avatar: { ...c.avatar, glowEnabled: v } }))} />
        {theme.avatar.glowEnabled && <ColorControl label="Couleur lueur" value={theme.avatar.glowColor} onChange={(v) => updateTheme((c) => ({ ...c, avatar: { ...c.avatar, glowColor: v } }))} />}
      </ControlGroup>

      <ControlGroup title="Bannière">
        <MediaUpload
          type="BANNER"
          currentUrl={theme.banner.url}
          onUploaded={(asset) => { replaceMedia("BANNER", asset); updateTheme((c) => ({ ...c, banner: { ...c.banner, url: asset.url } })); }}
          onCleared={() => updateTheme((c) => ({ ...c, banner: { ...c.banner, url: undefined } }))}
        />
        {biolink.owner.discordBanner && (
          <button
            type="button"
            onClick={() => updateTheme((c) => ({ ...c, banner: { ...c.banner, url: biolink.owner.discordBanner! } }))}
            className="self-start rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/10 px-3 py-1.5 text-xs font-medium text-[#8b9cf7] transition-colors hover:bg-[#5865F2]/20"
            title="Utiliser la bannière du compte Discord lié"
          >
            Utiliser ma bannière Discord
          </button>
        )}
        {theme.banner.url && (
          <SliderControl label="Hauteur" value={theme.banner.height} min={40} max={400} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, banner: { ...c.banner, height: v } }))} />
        )}
      </ControlGroup>

      <ControlGroup title="Musique">
        {/* Le son d'une vidéo de fond se règle ici, avec les autres sons. Il
            passe au-dessus de « Choisir une musique » : quand il est activé,
            la vidéo EST la musique de la page, et le choix d'un fichier audio
            disparaît — il n'y a pas deux sons à la fois. */}
        {theme.background.kind === "video" && (
          <>
            <ToggleControl
              label="Son de la vidéo"
              description="Utilise l'audio de la vidéo de fond comme musique de la page."
              checked={theme.background.useVideoAudio}
              onChange={(useVideoAudio) => updateTheme((c) => (c.background.kind === "video" ? { ...c, background: { ...c.background, useVideoAudio } } : c))}
            />
            {theme.background.useVideoAudio && (
              <SliderControl label="Volume de la vidéo" value={theme.background.volume} min={0} max={1} step={0.05} onChange={(volume) => updateTheme((c) => (c.background.kind === "video" ? { ...c, background: { ...c.background, volume } } : c))} />
            )}
          </>
        )}

        {/* Quand le son de la vidéo est actif, on ne propose plus de musique
            séparée : le bouton de désactivation ci-dessus et son volume
            suffisent. */}
        {!(theme.background.kind === "video" && theme.background.useVideoAudio) && (
          <>
            <MediaUpload
              type="AUDIO"
              currentUrl={theme.audio.url}
              onUploaded={(asset) => { replaceMedia("AUDIO", asset); updateTheme((c) => ({ ...c, audio: { ...c.audio, enabled: true, url: asset.url } })); }}
              onCleared={() => updateTheme((c) => ({ ...c, audio: { ...c.audio, enabled: false, url: undefined } }))}
            />
            {theme.audio.url && (
              <>
                <ToggleControl label="Activer la musique" checked={theme.audio.enabled} onChange={(v) => updateTheme((c) => ({ ...c, audio: { ...c.audio, enabled: v } }))} />
                <SliderControl label="Volume" value={theme.audio.volume} min={0} max={1} step={0.05} onChange={(v) => updateTheme((c) => ({ ...c, audio: { ...c.audio, volume: v } }))} />
              </>
            )}
          </>
        )}
      </ControlGroup>

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
            <ToggleControl label="Traînée" checked={theme.cursor.trailEnabled} onChange={(trailEnabled) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, trailEnabled } }))} />
            {theme.cursor.trailEnabled && (
              <>
                <SelectControl label="Particules de la traînée" value={theme.cursor.trailKind} options={[{ value: "circles", label: "Ronds" }, { value: "stars", label: "Étoiles" }, { value: "squares", label: "Carrés" }, { value: "astra", label: "Logo astra" }]} onChange={(trailKind) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, trailKind } }))} />
                <ColorControl label="Couleur de la traînée" value={theme.cursor.trailColor} onChange={(trailColor) => updateTheme((c) => ({ ...c, cursor: { ...c.cursor, trailColor } }))} />
              </>
            )}
          </>
        )}
      </ControlGroup>

      <ControlGroup title="Effets">
        <ToggleControl label="Inclinaison 3D au survol" checked={theme.effects.tiltEnabled} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tiltEnabled: v } }))} />
        {theme.effects.tiltEnabled && (
          <SliderControl label="Intensité de l'inclinaison" value={theme.effects.tiltIntensity} min={1} max={25} onChange={(tiltIntensity) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tiltIntensity } }))} />
        )}
        <ToggleControl label="Particules" checked={theme.effects.particles.enabled} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, enabled: v } } }))} />
        {theme.effects.particles.enabled && (
          <>
            <SelectControl label="Type" value={theme.effects.particles.kind} options={[{ value: "stars", label: "Étoiles" }, { value: "snow", label: "Neige" }, { value: "bubbles", label: "Bulles" }, { value: "confetti", label: "Confettis" }, { value: "rain", label: "Pluie" }]} onChange={(kind) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, kind } } }))} />
            <ColorControl label="Couleur" value={theme.effects.particles.color} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, color: v } } }))} />
            <SliderControl label="Quantité" value={theme.effects.particles.count} min={5} max={200} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, count: v } } }))} />
            <SliderControl label="Vitesse" value={theme.effects.particles.speed} min={0.1} max={5} step={0.1} onChange={(v) => updateTheme((c) => ({ ...c, effects: { ...c.effects, particles: { ...c.effects.particles, speed: v } } }))} />
          </>
        )}
        <SelectControl label="Animation du titre" value={theme.effects.titleAnimation} options={[{ value: "none", label: "Aucune" }, { value: "typewriter", label: "Machine à écrire" }, { value: "glitch", label: "Glitch" }, { value: "fade", label: "Fondu" }, { value: "sparkle", label: "Scintillement" }, { value: "wave", label: "Vague" }]} onChange={(titleAnimation) => updateTheme((c) => ({ ...c, effects: { ...c.effects, titleAnimation } }))} />
        <ToggleControl
          label="Animer le titre de l'onglet"
          description="Machine à écrire dans l'onglet du navigateur (le pseudo uniquement)."
          checked={theme.effects.tabTitleTypewriter}
          onChange={(tabTitleTypewriter) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tabTitleTypewriter } }))}
        />
        {theme.effects.tabTitleTypewriter && (
          <SliderControl label="Vitesse de l'onglet" value={theme.effects.tabTitleSpeed} min={20} max={300} unit="ms" onChange={(tabTitleSpeed) => updateTheme((c) => ({ ...c, effects: { ...c.effects, tabTitleSpeed } }))} />
        )}
        <SelectControl label="Entrée de page" value={theme.effects.entranceAnimation} options={[{ value: "none", label: "Aucune" }, { value: "fade", label: "Fondu" }, { value: "slide-up", label: "Glissement" }, { value: "zoom", label: "Zoom" }]} onChange={(entranceAnimation) => updateTheme((c) => ({ ...c, effects: { ...c.effects, entranceAnimation } }))} />
      </ControlGroup>

      <ControlGroup title="Écran d'entrée">
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
              options={fontChoices(theme.typography.customFontUrl)}
              onChange={(fontFamily) => updateTheme((c) => ({ ...c, entranceScreen: { ...c.entranceScreen, fontFamily } }))}
            />
            <SliderControl label="Flou de l'écran" value={theme.entranceScreen.blurAmount} min={0} max={40} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, entranceScreen: { ...c.entranceScreen, blurAmount: v } }))} />
          </>
        )}
        {(theme.audio.enabled || (theme.background.kind === "video" && theme.background.useVideoAudio)) && (
          <p className="text-xs text-content-muted">
            Les navigateurs bloquent l&apos;audio tant que le visiteur n&apos;a pas interagi avec la page. Le bouton de volume (en haut à gauche) permet de réactiver le son.
          </p>
        )}
      </ControlGroup>

      <ControlGroup title="Disposition">
        <SliderControl label="Largeur" value={theme.layout.maxWidth} min={320} max={768} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, layout: { ...c.layout, maxWidth: v } }))} />
        <SliderControl label="Espacement" value={theme.layout.spacing} min={4} max={32} unit="px" onChange={(v) => updateTheme((c) => ({ ...c, layout: { ...c.layout, spacing: v } }))} />
        <SelectControl label="Alignement" value={theme.layout.align} options={[{ value: "center", label: "Centré" }, { value: "left", label: "Gauche" }]} onChange={(align) => updateTheme((c) => ({ ...c, layout: { ...c.layout, align } }))} />
      </ControlGroup>
    </div>
  );
}
