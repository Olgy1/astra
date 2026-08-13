/**
 * Badges de la plateforme.
 *
 * Attribués exclusivement par un admin (jamais déclarés par l'utilisateur :
 * un badge auto-attribué ne vaut rien). Stockés sur `User.badges` comme un
 * simple tableau de clés — ajouter un badge = ajouter une entrée ici, aucune
 * migration.
 *
 * L'ordre de ce tableau est l'ordre d'affichage sur la page publique.
 */

export type BadgeKey = "verified" | "admin";

export type BadgeMeta = {
  key: BadgeKey;
  label: string;
  /** Pastille de l'éditeur et des listes admin. */
  color: string;
  /** Icône, résolue par le rendu (nom de chemin SVG). */
  icon?: string;
};

export const BADGES: BadgeMeta[] = [
  { key: "verified", label: "Vérifié", color: "#3b82f6" },
  { key: "admin", label: "Admin", color: "#8b5cf6" },
];

export const BADGE_BY_KEY: Record<BadgeKey, BadgeMeta> = Object.fromEntries(
  BADGES.map((badge) => [badge.key, badge])
) as Record<BadgeKey, BadgeMeta>;

export const BADGE_KEYS = BADGES.map((badge) => badge.key) as BadgeKey[];

/** Filtre des badges bruts venus de la base : inconnus ou dupliqués sont retirés. */
export function normalizeBadges(raw: unknown): BadgeKey[] {
  if (!Array.isArray(raw)) return [];

  return [...new Set(raw.filter((key): key is BadgeKey => BADGE_KEYS.includes(key as BadgeKey)))];
}
