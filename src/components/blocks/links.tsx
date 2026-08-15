"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BlockProps } from "@/components/blocks/types";
import type { LinksBlockConfig } from "@/lib/blocks/definitions/links";
import type { SocialsBlockConfig } from "@/lib/blocks/definitions/socials";
import type { CtaButtonBlockConfig } from "@/lib/blocks/definitions/cta-button";
import { SOCIAL_ICON_PATHS, SOCIAL_ICON_TRANSFORM, SOCIAL_META, contrastTextColor, detectPlatformFromUrl, socialUrl } from "@/lib/socials";
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
  const blockFont = resolveFontFamily(config.fontFamily, theme.typography.customFontUrl, theme.typography.customFontName);

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
      {links.map((link) => {
        // Icône logique : quand aucun émoji/image n'est saisi, on devine la
        // plateforme depuis l'URL du lien (youtube.com → logo YouTube…).
        const detected = detectPlatformFromUrl(link.url);

        return (
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
            {config.showIcons && (
              link.icon ? (
                /^https?:\/\//i.test(link.icon) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={link.icon} alt="" aria-hidden className="size-4 shrink-0 object-contain" />
                ) : (
                  // Tout ce qui n'est pas une URL est traité comme un émoji :
                  // une saisie « 🎮 » ou « 💜 » s'affiche telle quelle.
                  <span aria-hidden className="shrink-0 text-base leading-none">{link.icon}</span>
                )
              ) : detected ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4 shrink-0">
                  <path d={SOCIAL_ICON_PATHS[detected]} />
                </svg>
              ) : null
            )}
            <span className="truncate">{link.label}</span>
            {config.showClickCount && (
              <span className="ml-auto shrink-0 text-xs text-[var(--page-muted)]">
                {link.clicks}
              </span>
            )}
          </a>
        </li>
        );
      })}
    </ul>
  );
}

export function SocialsBlock({ config, page }: BlockProps<SocialsBlockConfig>) {
  // Les entrées sans valeur ne s'affichent pas.
  const entries = config.entries.filter((entry) => entry.value.trim().length > 0);
  // Index de l'entrée dont le pseudo vient d'être copié (feedback « Copié ! »).
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (entries.length === 0) return null;

  /** Copie un pseudo dans le presse-papiers (plateformes sans URL publique). */
  function copyValue(index: number, value: string) {
    const text = value.trim();
    const fallback = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignore : le clic ne doit jamais planter.
      }
      document.body.removeChild(textarea);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
    setCopiedIndex(index);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedIndex(null), 1500);
  }

  return (
    <ul
      className="flex flex-wrap items-center justify-center"
      // Le holder s'ouvre SOUS l'icône : on réserve toujours un peu de place
      // en bas pour qu'il ne déborde pas de la carte (coins arrondis +
      // overflow), quelle que soit la position du compteur de vues.
      style={{ gap: `${config.gap}px`, paddingBottom: "16px" }}
    >
      {entries.map((entry, index) => {
        // Icône « logique » : une URL complète d'une plateforme connue
        // affiche l'icône de CETTE plateforme, même si la sélection déclarée
        // est « website ». Sinon on garde la plateforme déclarée.
        const detected = detectPlatformFromUrl(entry.value);
        const iconPlatform = detected ?? entry.platform;
        const meta = SOCIAL_META[iconPlatform];

        // Lien si la valeur mène à une URL (profil, email, site…) ; sinon
        // on copie le pseudo (Discord n'a pas de page publique, par ex.).
        const href = socialUrl(entry.platform, entry.value);
        const isCopy = href === null;

        // Cercle plein de l'icône : couleur de la marque (si demandée) ou
        // l'accent du thème. Le tracé est blanc par-dessus (sombre seulement
        // sur une marque claire, ex. Snapchat) : un tracé sombre sur un cercle
        // coloré devenait illisible et « sale ».
        const circleBg = config.useBrandColors ? meta.color : "var(--page-accent)";
        const circleColor = config.useBrandColors ? contrastTextColor(meta.color) : "#ffffff";
        // Le cercle est nettement plus grand que l'icône : celle-ci reste à
        // distance du bord (padding équilibré tout autour, pas de contact).
        const circleSize = Math.max(40, config.iconSize + 16);
        const outlined = config.style === "outlined";

        const circleClasses = [
          "group relative flex shrink-0 items-center justify-center rounded-full transition-all duration-200",
          config.hoverEffect === "lift" ? "hover:-translate-y-1" : "",
          config.hoverEffect === "glow" ? "hover:drop-shadow-[0_0_8px_var(--page-accent)]" : "",
          config.hoverEffect === "bounce" ? "hover:animate-bounce" : "",
          "hover:scale-105 active:scale-95",
        ]
          .filter(Boolean)
          .join(" ");

        const circleStyle: CSSProperties = {
          width: circleSize,
          height: circleSize,
          ...(outlined
            ? {
                color: circleBg,
                border: `2px solid color-mix(in oklab, ${circleBg} 55%, transparent)`,
              }
            : { backgroundColor: circleBg, color: circleColor }),
        };

        const icon = (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            style={{ width: config.iconSize, height: config.iconSize }}
          >
            <path d={SOCIAL_ICON_PATHS[iconPlatform]} transform={SOCIAL_ICON_TRANSFORM[iconPlatform]} />
          </svg>
        );

        // Nom au survol uniquement, dans un holder assorti à la carte (même
        // opacité/flou que la pastille du compteur de vues).
        const tooltip = (
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-transparent px-3 py-1 text-[11px] font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
            style={{
              color: "var(--page-text)",
              backgroundColor: "color-mix(in oklab, var(--card-bg) calc(var(--card-opacity) * 100%), transparent)",
              backdropFilter: "blur(var(--card-blur))",
            }}
          >
            {isCopy && copiedIndex === index ? "Copié !" : meta.label}
          </span>
        );

        if (isCopy) {
          return (
            <li key={`${entry.platform}-${index}`}>
              <button
                type="button"
                onClick={() => copyValue(index, entry.value)}
                aria-label={`Copier ${meta.label} : ${entry.value.trim()}`}
                className={circleClasses}
                style={circleStyle}
              >
                {icon}
                {tooltip}
              </button>
            </li>
          );
        }

        return (
          <li key={`${entry.platform}-${index}`}>
            <a
              href={href}
              target={entry.newTab ? "_blank" : undefined}
              rel="noopener noreferrer nofollow"
              aria-label={meta.label}
              className={circleClasses}
              style={circleStyle}
            >
              {icon}
              {tooltip}
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
        fontFamily: resolveFontFamily(config.fontFamily, theme.typography.customFontUrl, theme.typography.customFontName),
      }}
    >
      {config.label}
    </a>
  );
}
