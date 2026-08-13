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

export type FontChoice = { value: string; label: string };

export const FONT_FAMILIES = [
  "Inter",
  "Poppins",
  "Montserrat",
  "JetBrains Mono",
  "Playfair Display",
] as const;

export const FONT_LABELS: Record<string, string> = {
  Inter: "Inter",
  Poppins: "Poppins",
  Montserrat: "Montserrat",
  "JetBrains Mono": "Mono",
  "Playfair Display": "Serif",
  custom: "Personnalisée",
};

/** Options du sélecteur, police custom incluse si `customFontUrl` est posé. */
export function fontChoices(customFontUrl?: string): FontChoice[] {
  const choices: FontChoice[] = FONT_FAMILIES.map((family) => ({
    value: family,
    label: FONT_LABELS[family],
  }));

  if (customFontUrl) choices.push({ value: "custom", label: "Personnalisée" });

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
  customFontUrl?: string
): string | undefined {
  if (!fontFamily || fontFamily === "inherit") return undefined;

  if (fontFamily === "custom") {
    // La police custom n'est chargée que si elle a été uploadée. Sans elle,
    // "custom" n'est pas une famille valide : on retombe sur Inter.
    return customFontUrl ? '"AstraCustom", sans-serif' : '"Inter", sans-serif';
  }

  return `"${fontFamily}", sans-serif`;
}
