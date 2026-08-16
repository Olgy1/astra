import { AnimatedText } from "@/components/public/animated-text";
import type { BlockProps } from "@/components/blocks/types";
import type { AvatarBlockConfig } from "@/lib/blocks/definitions/avatar";
import type { HeaderBlockConfig, HeaderSize } from "@/lib/blocks/definitions/header";
import type { TextBlockConfig } from "@/lib/blocks/definitions/text";
import type { ImageBlockConfig } from "@/lib/blocks/definitions/image";
import type { DividerBlockConfig } from "@/lib/blocks/definitions/divider";
import { mediaUrl } from "@/lib/biolinks/public-types";
import { renderInlineMarkdown } from "@/lib/markdown";
import { resolveFontFamily } from "@/lib/theme/fonts";

export function AvatarBlock({ config, page, theme }: BlockProps<AvatarBlockConfig>) {
  // Priorité par défaut : image du block, puis média uploadé, puis avatar
  // Discord. Quand « Utiliser l'avatar Discord » est activé dans le thème,
  // l'avatar Discord passe devant l'upload.
  // Le dernier recours est l'initiale du pseudo : une page sans avatar reste
  // une page, elle ne doit pas afficher un carré vide.
  const src = theme.avatar.useDiscord
    ? page.owner.discordAvatar ?? mediaUrl(page, "AVATAR") ?? config.imageUrl ?? null
    : config.imageUrl ?? mediaUrl(page, "AVATAR") ?? page.owner.discordAvatar ?? null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {src ? (
          // <img> et non next/image : l'URL vient d'un bucket utilisateur et
          // peut être n'importe quel hôte configuré. L'optimiseur de Next
          // exige une liste d'hôtes fermée, incompatible avec un domaine
          // personnalisé par utilisateur.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`Avatar de ${page.owner.username}`}
            width={theme.avatar.size}
            height={theme.avatar.size}
            loading="eager"
            className="object-cover"
            style={{
              width: "var(--avatar-size)",
              height: "var(--avatar-size)",
              borderRadius: "var(--avatar-radius)",
              border: "var(--avatar-border-width) solid var(--avatar-border-color)",
              boxShadow: "var(--avatar-glow)",
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center bg-white/10 font-semibold uppercase"
            style={{
              width: "var(--avatar-size)",
              height: "var(--avatar-size)",
              borderRadius: "var(--avatar-radius)",
              border: "var(--avatar-border-width) solid var(--avatar-border-color)",
              boxShadow: "var(--avatar-glow)",
              fontSize: `calc(var(--avatar-size) / 2.5)`,
            }}
          >
            {page.owner.username.charAt(0)}
          </div>
        )}

      </div>

      {config.statusText && (
        <p
          className="text-xs text-[var(--page-muted)]"
          style={{ fontFamily: resolveFontFamily(config.fontFamily, theme.typography.customFontUrl, theme.typography.customFontName) }}
        >
          {config.statusEmoji && <span className="mr-1">{config.statusEmoji}</span>}
          {config.statusText}
        </p>
      )}
    </div>
  );
}

const HEADER_SIZE_CLASSES: Record<HeaderSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
};

export function HeaderBlock({ config, page, theme }: BlockProps<HeaderBlockConfig>) {
  const title = config.title ?? page.title ?? page.owner.username;
  const bio = config.bio ?? page.description;

  // Dégradé texte → accent, animé, quand l'option est active. On l'écarte
  // quand une animation de titre déplace ou duplique les caractères
  // (wave, glitch) : `background-clip: text` sur le parent ne suit pas les
  // transformations des enfants, et le texte devient invisible. Sparkle a
  // déjà son propre dégradé. Wave, glitch et sparkle retombent donc sur la
  // couleur unie — le texte reste visible.
  const gradientTitle =
    theme.typography.titleGradient &&
    !["sparkle", "wave", "glitch"].includes(theme.effects.titleAnimation);

  // Chaque zone du block a sa propre police : titre, sous-titre et bio se
  // règlent indépendamment. Chacune retombe sur la police par défaut du
  // block (fontFamily), puis sur la police globale de la page. « inherit »
  // explicite sur une zone = police de la page, même si le block en a une.
  // La police custom est propre au block En-tête (plus d'upload global).
  const titleFont = resolveFontFamily(config.titleFontFamily ?? config.fontFamily, config.customFontUrl, config.customFontName);
  const subtitleFont = resolveFontFamily(config.subtitleFontFamily ?? config.fontFamily, config.customFontUrl, config.customFontName);
  const bioFont = resolveFontFamily(config.bioFontFamily ?? config.fontFamily, config.customFontUrl, config.customFontName);

  // Tailles par zone, réglables séparément dans l'éditeur.
  const titleSizeClass = HEADER_SIZE_CLASSES[config.titleSize ?? "2xl"];
  const subtitleSizeClass = HEADER_SIZE_CLASSES[config.subtitleSize ?? "sm"];
  const bioSizeClass = HEADER_SIZE_CLASSES[config.bioSize ?? "sm"];

  return (
    <header className="flex flex-col items-center gap-1.5">
      <h1
        className={`${titleSizeClass} font-bold leading-tight ${
          gradientTitle
            ? "bg-[linear-gradient(90deg,var(--title-gradient-1),var(--title-gradient-2),var(--title-gradient-1))] bg-[length:200%_auto] bg-clip-text text-transparent [animation:sparkle_4s_linear_infinite]"
            : ""
        }`}
        style={{ fontFamily: titleFont }}
      >
        <AnimatedText
          text={title}
          animation={theme.effects.titleAnimation}
          speed={theme.effects.titleAnimationSpeed}
        />
      </h1>

      {config.showUsername && title !== page.owner.username && (
        <p className="text-sm text-[var(--page-muted)]" style={{ fontFamily: subtitleFont }}>
          @{page.owner.username}
        </p>
      )}

      {/* Sous-titre et bio : ordre réglable via `bioBeforeSubtitle` (défaut :
          sous-titre d'abord, bio ensuite). */}
      {config.bioBeforeSubtitle ? (
        <>
          {bio && (
            // whitespace-pre-line : les retours à la ligne saisis dans la bio
            // sont conservés à l'affichage (un `\n` devient un saut de ligne),
            // sans pour autant étendre les espaces multiples.
            <p
              className={`mt-1 max-w-prose whitespace-pre-line ${bioSizeClass} leading-relaxed opacity-90`}
              style={{ fontFamily: bioFont }}
            >
              {config.bioAnimation && config.bioAnimation !== "none" ? (
                <AnimatedText
                  text={bio}
                  animation={config.bioAnimation}
                  speed={config.bioAnimationSpeed ?? 80}
                />
              ) : (
                bio
              )}
            </p>
          )}
          {config.subtitle && (
            <p className={`${subtitleSizeClass} text-[var(--page-muted)]`} style={{ fontFamily: subtitleFont }}>
              {config.subtitle}
            </p>
          )}
        </>
      ) : (
        <>
          {config.subtitle && (
            <p className={`${subtitleSizeClass} text-[var(--page-muted)]`} style={{ fontFamily: subtitleFont }}>
              {config.subtitle}
            </p>
          )}
          {bio && (
            // whitespace-pre-line : les retours à la ligne saisis dans la bio
            // sont conservés à l'affichage (un `\n` devient un saut de ligne),
            // sans pour autant étendre les espaces multiples.
            <p
              className={`mt-1 max-w-prose whitespace-pre-line ${bioSizeClass} leading-relaxed opacity-90`}
              style={{ fontFamily: bioFont }}
            >
              {config.bioAnimation && config.bioAnimation !== "none" ? (
                <AnimatedText
                  text={bio}
                  animation={config.bioAnimation}
                  speed={config.bioAnimationSpeed ?? 80}
                />
              ) : (
                bio
              )}
            </p>
          )}
        </>
      )}

      {/* Les badges de l'en-tête (custom) ne sont plus affichés : la
          fonctionnalité a été désactivée sur toutes les pages. */}
    </header>
  );
}

const TEXT_SIZES = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-xl" } as const;

export function TextBlock({ config, theme }: BlockProps<TextBlockConfig>) {
  if (!config.content) return null;

  // Une animation de texte anime la chaîne brute : le markdown n'est pas
  // interprété dans ce cas (machine à écrire, vague… travaillent caractère
  // par caractère). Le texte brut reste donc le seul contenu animé.
  const animated = config.animation && config.animation !== "none";

  return (
    <p
      className={[
        TEXT_SIZES[config.size],
        config.italic ? "italic" : "",
        config.bold ? "font-semibold" : "",
        "leading-relaxed",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        textAlign: config.align,
        color: config.useAccentColor ? "var(--page-accent)" : undefined,
        fontFamily: resolveFontFamily(config.fontFamily, theme.typography.customFontUrl, theme.typography.customFontName),
      }}
    >
      {animated ? (
        <AnimatedText
          text={config.content}
          animation={config.animation!}
          speed={config.animationSpeed ?? 80}
        />
      ) : (
        // Le contenu est du markdown restreint converti par notre propre
        // fonction : gras, italique, souligné, barré, liens. Aucun HTML de
        // l'utilisateur n'atteint cet attribut — voir lib/markdown.ts.
        <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(config.content) }} />
      )}
    </p>
  );
}

export function ImageBlock({ config }: BlockProps<ImageBlockConfig>) {
  if (!config.url) return null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={config.url}
      alt={config.alt}
      loading="lazy"
      className="w-full"
      style={{
        borderRadius: `${config.borderRadius}px`,
        objectFit: config.fit,
        height: config.height ? `${config.height}px` : "auto",
      }}
    />
  );

  if (!config.linkUrl) return image;

  return (
    // noopener : sans lui, la page ouverte peut manipuler la nôtre via
    // window.opener. noreferrer : on n'envoie pas l'adresse de la page.
    <a href={config.linkUrl} target="_blank" rel="noopener noreferrer nofollow">
      {image}
    </a>
  );
}

export function DividerBlock({ config }: BlockProps<DividerBlockConfig>) {
  if (config.style === "space") {
    return <div aria-hidden style={{ height: `${config.spacing}px` }} />;
  }

  const line = (
    <span
      aria-hidden
      className="flex-1"
      style={{
        height: config.style === "gradient" ? `${config.thickness}px` : 0,
        opacity: config.opacity,
        ...(config.style === "gradient"
          ? { background: "linear-gradient(90deg, transparent, var(--page-text), transparent)" }
          : {
              borderTopWidth: `${config.thickness}px`,
              borderTopStyle: config.style === "line" ? "solid" : config.style,
              borderTopColor: "currentColor",
            }),
      }}
    />
  );

  return (
    <div
      className="flex items-center gap-3"
      style={{ marginBlock: `${config.spacing / 2}px` }}
    >
      {line}
      {config.label && (
        <span className="shrink-0 text-xs uppercase tracking-wider text-[var(--page-muted)]">
          {config.label}
        </span>
      )}
      {config.label && line}
    </div>
  );
}
