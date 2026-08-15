/**
 * Nom d'affichage d'une police custom, dérivé du nom du fichier uploadé.
 *
 * « pixel-rounded.ttf » → « Pixel Rounded », «Montserrat-Bold.woff2 » →
 * « Montserrat Bold ». Le résultat sert de famille CSS (échappé) et de
 * libellé dans les sélecteurs, pour que plusieurs polices custom coexistent
 * sans se confondre.
 */

/**
 * Nom d'affichage propre à partir d'un nom de fichier brut.
 *
 * « pixel-rounded.ttf » → « Pixel Rounded », « ma-musique.mp3 » →
 * « Ma Musique ». Utilisé pour la police custom ET pour le titre des pistes
 * audio (l'URL de stockage porte un UUID, pas le nom envoyé par
 * l'utilisateur).
 */
export function displayNameFromFileName(fileName: string | undefined): string | undefined {
  if (!fileName) return undefined;

  let base = fileName.replace(/\.[a-z0-9]{1,8}$/i, ""); // sans l'extension
  if (!base) return undefined;

  // Un UUID ou hash de 8+ caractères hexadécimaux en préfixe est une trace
  // du stockage, pas du nom du fichier : on le retire.
  base = base.replace(/^[0-9a-f]{8,}-/i, "");

  const words = base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) return undefined;

  const title = words
    .map((word) => (word.length <= 2 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");

  return title.length > 40 ? title.slice(0, 40).trim() : title;
}

/** Nettoyage d'un nom de police, à partir de l'URL uploadée. */
export function fontNameFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const pathname = decodeURIComponent(new URL(url).pathname);
    // Dernier segment : le nom de fichier.
    return displayNameFromFileName(pathname.split("/").pop());
  } catch {
    return undefined;
  }
}

/** Nom de famille CSS sûr pour une police custom (échappé pour @font-face). */
export function fontFamilyName(name: string): string {
  // Nettoie tout ce qui pourrait sortir d'un identifiant CSS entre guillemets.
  return name.replace(/["\\]/g, "");
}
