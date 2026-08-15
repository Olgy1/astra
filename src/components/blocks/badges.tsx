import type { BlockProps } from "@/components/blocks/types";
import type { BadgesBlockConfig } from "@/lib/blocks/definitions/badges";
import { BADGE_BY_KEY, type BadgeKey } from "@/lib/badges";
import { resolveFontFamily } from "@/lib/theme/fonts";

/** Pictogramme de chaque badge, résolu par clé. */
function BadgeIcon({ badge }: { badge: BadgeKey }) {
  if (badge === "verified") {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
        <path d="M9.55 17.55 4.5 12.5l1.4-1.4 3.65 3.65L18.1 6.9l1.4 1.4-9.95 9.25z" />
      </svg>
    );
  }

  // admin et les futurs badges : bouclier.
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
      <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    </svg>
  );
}

/**
 * Badges du compte, en ligne horizontale — icône seule, nom au survol.
 *
 * Les badges viennent du propriétaire de la page (User.badges), attribués par
 * un admin. Le block est mis de base sur les nouvelles pages mais reste
 * retirable : un compte sans badge n'affiche rien.
 *
 * Volontairement discrets : une pastille par badge, sans libellé — le nom
 * apparaît dans une bulle au survol. Un rang de pastilles colorées se lit
 * d'un coup d'œil, un rang de libellés ferait concurrence au reste de la
 * carte.
 */
export function BadgesBlock({ config, page, theme }: BlockProps<BadgesBlockConfig>) {
  const badges = (page.owner.badges ?? []) as BadgeKey[];
  const visible = badges.filter((badge) => BADGE_BY_KEY[badge]);

  if (visible.length === 0) return null;

  return (
    <ul
      className="flex flex-wrap items-center justify-center gap-1.5"
      style={{ fontFamily: resolveFontFamily(config.fontFamily, theme.typography.customFontUrl, theme.typography.customFontName) }}
    >
      {visible.map((badge) => {
        const meta = BADGE_BY_KEY[badge];

        return (
          <li
            key={badge}
            aria-label={meta.label}
            role="img"
            className={[
              "group relative inline-flex size-7 items-center justify-center rounded-full",
              config.style === "filled" ? "" : "border",
            ].join(" ")}
            style={{
              color: meta.color,
              backgroundColor: config.style === "filled" ? `${meta.color}22` : undefined,
              borderColor: config.style === "filled" ? undefined : `${meta.color}55`,
            }}
          >
            <BadgeIcon badge={badge} />
            {/* Libellé au survol. La carte a un `overflow: hidden` : la
                bulle s'ouvre donc vers le bas, dans le flux de la page. */}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
            >
              {meta.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
