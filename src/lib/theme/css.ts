import type { CSSProperties } from "react";
import type { Background, ThemeConfig } from "@/lib/schemas/theme";
import { fontFamilyName, fontNameFromUrl } from "@/lib/theme/font-name";
import { fontFamilyCss } from "@/lib/theme/fonts";

/**
 * Traduction de `themeConfig` en CSS.
 *
 * La personnalisation devient un jeu de variables CSS posées en style inline
 * sur le conteneur de la page. Les composants de rendu lisent ces variables
 * et ne connaissent jamais `themeConfig` : ajouter une option de thème ne
 * demande donc pas de toucher aux quinze blocks.
 *
 * Aucune valeur n'arrive ici sans être passée par `themeConfigSchema` : les
 * couleurs sont des hex validés par regex, les URL sont restreintes à
 * http(s). C'est ce qui rend sûr de les injecter dans du style — une chaîne
 * libre dans un `background-image: url(...)` serait une porte ouverte.
 */

/** Variables CSS exposées à la page publique. */
export type ThemeVars = CSSProperties & Record<`--${string}`, string | number>;

function gradientCss(background: Extract<Background, { kind: "gradient" }>): string {
  const stops = background.stops
    .map((stop) => `${stop.color} ${stop.at}%`)
    .join(", ");

  switch (background.type) {
    case "radial":
      return `radial-gradient(circle at center, ${stops})`;
    case "conic":
      return `conic-gradient(from ${background.angle}deg at center, ${stops})`;
    default:
      return `linear-gradient(${background.angle}deg, ${stops})`;
  }
}

export function themeToCssVars(theme: ThemeConfig): ThemeVars {
  const { typography, card, avatar, layout, effects, cursor } = theme;

  return {
    "--page-text": typography.textColor,
    "--page-accent": typography.accentColor,
    "--page-muted": typography.mutedColor,
    // La police globale ne suit plus une police custom (l'upload global a
    // été retiré : la custom ne vit plus que dans le block En-tête). Un
    // ancien `customFontUrl` traînant en base ne doit donc pas écraser le
    // choix du catalogue — sinon la page garde éternellement l'ancienne
    // police, quel que soit le sélecteur.
    "--page-font": fontFamilyCss(typography.fontFamily),
    "--page-font-size": `${typography.fontSize}px`,
    "--page-letter-spacing": `${typography.letterSpacing}px`,
    // Halo néon sous le texte : deux ombres pour un rendu plus dense qu'une
    // seule. Une seconde couleur (si différente) ajoute un halo plus diffus
    // dans cette teinte — halo bicolore. `none` désactive proprement.
    "--page-text-glow": typography.textGlow
      ? `0 0 ${typography.textGlowIntensity}px ${typography.textGlowColor}, 0 0 ${typography.textGlowIntensity * 2}px ${typography.textGlowColor}${typography.textGlowColor2 !== typography.textGlowColor ? `, 0 0 ${typography.textGlowIntensity * 1.5}px ${typography.textGlowColor2}` : ""}`
      : "none",

    "--card-bg": card.backgroundColor,
    "--card-opacity": card.opacity,
    "--card-blur": `${card.blur}px`,
    "--card-radius": `${card.borderRadius}px`,
    "--card-border-width": `${card.borderWidth}px`,
    "--card-border-color": card.borderColor,
    "--card-shadow": card.shadowSize > 0 ? `0 8px ${card.shadowSize}px ${card.shadowColor}` : "none",
    // Lueur bicolore : un second halo, plus large et diffus, dans la seconde
    // couleur — uniquement si elle diffère, pour ne pas changer les pages
    // existantes.
    "--card-glow": card.glowEnabled
      ? `0 0 60px -10px ${card.glowColor}${card.glowColor2 !== card.glowColor ? `, 0 0 90px -12px ${card.glowColor2}` : ""}`
      : "none",
    "--card-beam-color": card.animatedBorderColor,
    "--card-beam-color2": card.animatedBorderColor2,

    "--avatar-size": `${avatar.size}px`,
    "--avatar-radius": avatar.shape === "circle" ? "9999px" : avatar.shape === "rounded" ? "16px" : "0px",
    "--avatar-border-width": `${avatar.borderWidth}px`,
    "--avatar-border-color": avatar.borderColor,
    "--avatar-glow": avatar.glowEnabled
      ? `0 0 24px -2px ${avatar.glowColor}${avatar.glowColor2 !== avatar.glowColor ? `, 0 0 40px -4px ${avatar.glowColor2}` : ""}`
      : "none",

    "--layout-width": `${layout.maxWidth}px`,
    "--layout-gap": `${layout.spacing}px`,
    "--layout-align": layout.align === "center" ? "center" : "flex-start",
    "--layout-text-align": layout.align,

    "--tilt-intensity": effects.tiltIntensity,
    "--cursor-trail": cursor.trailColor,
    "--cursor-trail-2": cursor.trailColor2,
  };
}

/**
 * Styles du calque d'arrière-plan.
 *
 * La vidéo est rendue par un `<video>` dédié : `background-image` ne sait pas
 * l'afficher. Ce cas retourne donc un fond transparent, et le composant
 * `PageBackground` prend le relais.
 */
export function backgroundStyle(background: Background): CSSProperties {
  switch (background.kind) {
    case "solid":
      return { backgroundColor: background.color };

    case "gradient":
      return { backgroundImage: gradientCss(background) };

    case "image":
      return {
        backgroundImage: `url(${JSON.stringify(background.url)})`,
        backgroundSize: background.fit === "tile" ? "auto" : background.fit,
        backgroundRepeat: background.fit === "tile" ? "repeat" : "no-repeat",
        backgroundPosition: "center",
      };

    case "video":
      return {};
  }
}

/** Voile d'assombrissement et flou, communs à l'image et à la vidéo. */
export function backgroundOverlayStyle(background: Background): CSSProperties | null {
  if (background.kind !== "image" && background.kind !== "video") return null;
  if (background.dim <= 0) return null;

  return { backgroundColor: `rgba(0, 0, 0, ${background.dim})` };
}

export function backgroundBlur(background: Background): string | undefined {
  if (background.kind !== "image" && background.kind !== "video") return undefined;
  return background.blur > 0 ? `blur(${background.blur}px)` : undefined;
}

/**
 * Règle @font-face pour une police uploadée.
 *
 * `url` vient de `themeConfigSchema` (donc http(s) validé) et passe par
 * `JSON.stringify`, qui échappe les guillemets. Sans ça, une URL contenant un
 * `"` refermerait la chaîne CSS et permettrait d'injecter des règles
 * arbitraires dans la page.
 */
export function customFontFace(theme: ThemeConfig): string | null {
  const url = theme.typography.customFontUrl;
  if (!url) return null;

  // Le nom de famille vient du fichier uploadé (nom dérivé, ou valeur
  // enregistrée). Sans lui, on retombe sur « AstraCustom » : les pages
  // créées avant ce champ continuent d'afficher leur police.
  const customFontName = theme.typography.customFontName ?? fontNameFromUrl(url) ?? "AstraCustom";

  return fontFaceRule(url, customFontName);
}

/**
 * Règle @font-face pour une URL et un nom de famille donnés.
 *
 * Utilisée pour la police globale ET pour la police custom du block En-tête.
 * `url` et `name` passent tous deux par des garde-fous : `JSON.stringify`
 * échappe les guillemets de l'URL, et `fontFamilyName` nettoie le nom pour
 * qu'il reste un identifiant CSS sûr.
 */
export function fontFaceRule(url: string, name: string): string {
  return `@font-face {
  font-family: "${fontFamilyName(name)}";
  src: url(${JSON.stringify(url)});
  font-display: swap;
}`;
}
