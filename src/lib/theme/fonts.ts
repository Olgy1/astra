import { fontFamilyName, fontNameFromUrl } from "@/lib/theme/font-name";

/**
 * Catalogue des polices proposées sur la plateforme.
 *
 * Partagé entre le panneau de thème (police globale) et l'éditeur de blocks
 * (police par block) : une seule liste, un seul libellé. Les polices du
 * catalogue sont chargées par la page publique (voir src/app/[slug]/...).
 *
 * Une police custom uploadée (FONT) est disponible sous la valeur "custom",
 * mais seulement si l'utilisateur a bien uploadé la sienne : le rendu
 * vérifie `customFontUrl` et retombe sur Inter sinon.
 */

export type FontChoice = { value: string; label: string; fontStack?: string };

export const FONT_FAMILIES = [
  "Evil Empire",
  "Fonstars",
  "Harry P",
  "Help Me",
  "Ichigaya Mincho",
  "Inter",
  "Ithaca",
  "Jello Stone",
  "JetBrains Mono",
  "Juliette",
  "Juliette Italic",
  "Martius",
  "Martius Italic",
  "Minecraft",
  "Minecraft Bold",
  "Minecraft Bold Italic",
  "Minecraft Italic",
  "Montserrat",
  "Moogalator",
  "Moogalator Filler",
  "Moonhouse",
  "Nikkyou Sans",
  "Oblata Display",
  "Pixelated Elegance",
  "Playfair Display",
  "Poppins",
  "Providencia",
  "Raster Forge",
  "RO Spritendo",
  "Roblox",
  "Rusty Hooks",
  "Sacramento",
  "Sparky Stones",
  "Spongeboy",
  "Star Jedi",
  "Star Jedi Hollow",
  "Star Jedi Rounded",
  "Super Cursed",
  "Super Maples",
  "Super Pencil",
  "Super Rugged",
  "Super Shake",
  "Truetypewriter Polyglott",
] as const;

export const FONT_LABELS: Record<string, string> = {
  "Evil Empire": "Evil Empire",
  Fonstars: "Fonstars",
  "Harry P": "Harry P",
  "Help Me": "Help Me",
  "Ichigaya Mincho": "Ichigaya Mincho",
  Inter: "Inter",
  Ithaca: "Ithaca",
  "Jello Stone": "Jello Stone",
  "JetBrains Mono": "JetBrains Mono",
  Juliette: "Juliette",
  "Juliette Italic": "Juliette Italic",
  Martius: "Martius",
  "Martius Italic": "Martius Italic",
  Minecraft: "Minecraft",
  "Minecraft Bold": "Minecraft Bold",
  "Minecraft Bold Italic": "Minecraft Bold Italic",
  "Minecraft Italic": "Minecraft Italic",
  Montserrat: "Montserrat",
  Moogalator: "Moogalator",
  "Moogalator Filler": "Moogalator Filler",
  Moonhouse: "Moonhouse",
  "Nikkyou Sans": "Nikkyou Sans",
  "Oblata Display": "Oblata Display",
  "Pixelated Elegance": "Pixelated Elegance",
  "Playfair Display": "Playfair Display",
  Poppins: "Poppins",
  Providencia: "Providencia",
  "Raster Forge": "Raster Forge",
  "RO Spritendo": "RO Spritendo",
  Roblox: "Roblox",
  "Rusty Hooks": "Rusty Hooks",
  Sacramento: "Sacramento",
  "Sparky Stones": "Sparky Stones",
  Spongeboy: "Spongeboy",
  "Star Jedi": "Star Jedi",
  "Star Jedi Hollow": "Star Jedi Hollow",
  "Star Jedi Rounded": "Star Jedi Rounded",
  "Super Cursed": "Super Cursed",
  "Super Maples": "Super Maples",
  "Super Pencil": "Super Pencil",
  "Super Rugged": "Super Rugged",
  "Super Shake": "Super Shake",
  "Truetypewriter Polyglott": "Truetypewriter Polyglott",
  custom: "Personnalisée",
};

/**
 * Crédits d'attribution obligatoires (licences CC BY, etc.) par police.
 *
 * Affiché sous le sélecteur quand la police sélectionnée en a un. Complète le
 * commentaire d'attribution de src/app/fonts.css : la licence CC BY exige une
 * attribution visible par l'utilisateur, pas seulement dans le code.
 */
export const FONT_CREDITS: Record<string, string> = {
  "Evil Empire": "Police « Evil Empire » par Tup Wanders (tupwanders.nl) — licence CC BY.",
};

/** Crédit d'une police du catalogue, ou `undefined` si aucune attribution requise. */
export function fontCredit(fontFamily: string | undefined): string | undefined {
  return fontFamily ? FONT_CREDITS[fontFamily] : undefined;
}

/**
 * Pile de polices CSS pour chaque police du catalogue.
 *
 * Chaque entrée référence la variable CSS exposée par `next/font/google`
 * (voir app/layout.tsx) et ajoute la famille de repli adaptée : sans-serif
 * pour les textes, monospace pour JetBrains Mono, serif pour Playfair
 * Display. Sans cette indirection, `font-family: "Poppins"` ne correspond à
 * rien d'installé chez le visiteur et toute page retombait sur la police
 * système — d'où l'impression que le choix ne changeait rien.
 */
export const FONT_STACKS: Record<string, string> = {
  Inter: "var(--font-inter), ui-sans-serif, sans-serif",
  Poppins: "var(--font-poppins), sans-serif",
  Montserrat: "var(--font-montserrat), sans-serif",
  "JetBrains Mono": "var(--font-jetbrains-mono), monospace",
  "Playfair Display": "var(--font-playfair), serif",
};

/** Famille CSS prête à l'emploi pour une valeur du catalogue (ou un nom libre). */
export function fontFamilyCss(fontFamily: string): string {
  return FONT_STACKS[fontFamily] ?? `"${fontFamily}", sans-serif`;
}

/** Nom d'affichage de la police custom : enregistré, sinon dérivé du fichier. */
export function customFontLabel(customFontUrl?: string, customFontName?: string): string {
  return customFontName ?? fontNameFromUrl(customFontUrl) ?? "Personnalisée";
}

/** Options du sélecteur, police custom incluse si `customFontUrl` est posé. */
export function fontChoices(customFontUrl?: string, customFontName?: string): FontChoice[] {
  const choices: FontChoice[] = FONT_FAMILIES.map((family) => ({
    value: family,
    label: FONT_LABELS[family],
    // Pile CSS utilisée pour l'aperçu dans le sélecteur (chaque option
    // affichée dans sa propre police).
    fontStack: fontFamilyCss(family),
  }));

  if (customFontUrl) {
    choices.push({
      value: "custom",
      label: customFontLabel(customFontUrl, customFontName),
      fontStack: resolveFontFamily("custom", customFontUrl, customFontName) ?? FONT_STACKS["Inter"],
    });
  }

  return choices;
}

/**
 * Famille CSS pour une valeur du catalogue.
 *
 * `fontFamily` peut être une police du catalogue, "custom", ou "inherit"
 * (pour les blocks : suivre la police globale de la page). Renvoie une
 * chaîne utilisable telle quelle dans un style `fontFamily`.
 */
export function resolveFontFamily(
  fontFamily: string | undefined,
  customFontUrl?: string,
  customFontName?: string
): string | undefined {
  if (!fontFamily || fontFamily === "inherit") return undefined;

  if (fontFamily === "custom") {
    // La police custom n'est chargée que si elle a été uploadée. Sans elle,
    // "custom" n'est pas une famille valide : on retombe sur Inter.
    if (!customFontUrl) return FONT_STACKS["Inter"];
    const name = customFontName ?? fontNameFromUrl(customFontUrl) ?? "AstraCustom";
    return `"${fontFamilyName(name)}", sans-serif`;
  }

  return fontFamilyCss(fontFamily);
}
