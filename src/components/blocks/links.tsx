"use client";

import type { BlockProps } from "@/components/blocks/types";
import type { LinksBlockConfig } from "@/lib/blocks/definitions/links";
import type { SocialsBlockConfig } from "@/lib/blocks/definitions/socials";
import type { CtaButtonBlockConfig } from "@/lib/blocks/definitions/cta-button";
import { SOCIAL_ICON_PATHS, SOCIAL_META, socialUrl } from "@/lib/socials";
import { resolveFontFamily } from "@/lib/theme/fonts";

/**
 * Enregistre un clic, sans retarder la navigation.
 *
 * `sendBeacon` est fait pour ça : le navigateur garde la requête en vol même
 * si la page se ferme. Un `fetch` classique serait annulé au moment où le lien
 * s'ouvre, et la moitié des clics ne seraient jamais comptés.
 */
function trackClick(slug: string, linkId: string): void {
  try {
    const payload = JSON.stringify({ linkId });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`/api/public/${slug}/click`, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(`/api/public/${slug}/click`, {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Un compteur qui rate ne doit jamais empêcher l'ouverture du lien.
  }
}

const BUTTON_STYLES: Record<LinksBlockConfig["buttonStyle"], string> = {
  solid: "bg-[var(--card-bg)] border border-[var(--card-border-color)]",
  outlined: "border-2 border-current bg-transparent",
  ghost: "bg-white/5 border border-transparent",
  neon: "border border-[var(--page-accent)] bg-transparent shadow-[0_0_16px_-4px_var(--page-accent)]",
};

const HOVER_EFFECTS: Record<LinksBlockConfig["hoverEffect"], string> = {
  none: "",
  lift: "hover:-translate-y-0.5",
  glow: "hover:shadow-[0_0_24px_-6px_var(--page-accent)]",
  shine: "hover:brightness-125",
  scale: "hover:scale-[1.02]",
};

export function LinksBlock({ config, page, theme }: BlockProps<LinksBlockConfig>) {
  const { from, to } = config.positionRange;
  const blockFont = resolveFontFamily(config.fontFamily, theme.typography.customFontUrl);

  // Le filtre par plage permet de découper les liens en plusieurs sections,
  // chacune avec sa présentation.
  const links = page.links.filter(
    (link) =>
      (from === undefined || link.position >= from) &&
      (to === undefined || link.position <= to)
  );

  if (links.length === 0) return null;

  return (
    <ul
      className={config.layout === "grid" ? "grid gap-2" : "flex flex-col gap-2"}
      style={
        config.layout === "grid"
          ? { gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {links.map((link) => (
        <li key={link.id}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => trackClick(page.slug, link.id)}
            className={[
              "flex min-h-[44px] items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200",
              BUTTON_STYLES[config.buttonStyle],
              HOVER_EFFECTS[config.hoverEffect],
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ borderRadius: "var(--card-radius)", fontFamily: blockFont }}
          >
            {config.showIcons && link.icon && (
              /^https?:\/\//i.test(link.icon) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={link.icon} alt="" aria-hidden className="size-4 shrink-0 object-contain" />
              ) : (
                // Tout ce qui n'est pas une URL est traité comme un émoji :
                // une saisie « 🎮 » ou « 💜 » s'affiche telle quelle.
                <span aria-hidden className="shrink-0 text-base leading-none">{link.icon}</span>
              )
            )}
            <span className="truncate">{link.label}</span>
            {config.showClickCount && (
              <span className="ml-auto shrink-0 text-xs text-[var(--page-muted)]">
                {link.clicks}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SocialsBlock({ config, page }: BlockProps<SocialsBlockConfig>) {
  // Les entrées dont l'URL n'est pas reconstructible sont écartées ici :
  // mieux vaut ne rien afficher qu'une icône qui ne mène nulle part, ou pire,
  // vers une valeur non validée.
  const entries = config.entries
    .map((entry) => ({ ...entry, href: socialUrl(entry.platform, entry.value) }))
    .filter((entry): entry is typeof entry & { href: string } => entry.href !== null);

  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center justify-center" style={{ gap: `${config.gap}px` }}>
      {entries.map((entry, index) => {
        const meta = SOCIAL_META[entry.platform];

        return (
          <li key={`${entry.platform}-${index}`}>
            <a
              href={entry.href}
              target={entry.newTab ? "_blank" : undefined}
              rel="noopener noreferrer nofollow"
              aria-label={meta.label}
              title={meta.label}
              className={[
                "flex items-center justify-center transition-all duration-200",
                config.style === "filled" ? "rounded-full bg-white/10 p-2.5" : "",
                config.style === "outlined" ? "rounded-full border border-current p-2.5" : "",
                config.hoverEffect === "lift" ? "hover:-translate-y-1" : "",
                config.hoverEffect === "glow" ? "hover:drop-shadow-[0_0_8px_var(--page-accent)]" : "",
                config.hoverEffect === "bounce" ? "hover:animate-bounce" : "",
                config.hoverEffect === "none" ? "" : "hover:opacity-100",
                "opacity-80",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ color: config.useBrandColors ? meta.color : undefined }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
                style={{ width: config.iconSize, height: config.iconSize }}
              >
                <path d={SOCIAL_ICON_PATHS[entry.platform]} />
              </svg>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

const CTA_VARIANTS: Record<CtaButtonBlockConfig["variant"], string> = {
  primary: "bg-[var(--page-accent)] text-white",
  secondary: "bg-[var(--card-bg)] border border-[var(--card-border-color)]",
  outline: "border-2 border-current",
  gradient: "bg-[linear-gradient(90deg,var(--page-accent),color-mix(in_oklab,var(--page-accent),white_35%))] text-white",
};

const CTA_SIZES: Record<CtaButtonBlockConfig["size"], string> = {
  sm: "px-4 py-2 text-xs",
  // 44px minimum en md et lg : c'est la taille de cible tactile en dessous de
  // laquelle un bouton devient difficile à viser au pouce.
  md: "px-5 py-3 text-sm min-h-[44px]",
  lg: "px-6 py-4 text-base min-h-[52px]",
};

export function CtaButtonBlock({ config, theme }: BlockProps<CtaButtonBlockConfig>) {
  if (!config.url) return null;

  return (
    <a
      href={config.url}
      target={config.newTab ? "_blank" : undefined}
      rel="noopener noreferrer nofollow"
      className={[
        "inline-flex items-center justify-center gap-2 font-semibold transition-transform hover:scale-[1.02]",
        CTA_VARIANTS[config.variant],
        CTA_SIZES[config.size],
        config.fullWidth ? "w-full" : "",
        config.pulse ? "animate-pulse" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderRadius: "var(--card-radius)",
        fontFamily: resolveFontFamily(config.fontFamily, theme.typography.customFontUrl),
      }}
    >
      {config.label}
    </a>
  );
}
