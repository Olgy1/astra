import type { ReactNode } from "react";
import type { PublicBlock, PublicPage } from "@/lib/biolinks/public-types";
import type { ThemeConfig } from "@/lib/schemas/theme";
import { themeToCssVars, customFontFace, fontFaceRule } from "@/lib/theme/css";
import { resolveFontFamily } from "@/lib/theme/fonts";
import { fontNameFromUrl } from "@/lib/theme/font-name";
import { PageBackground } from "@/components/public/background";
import { Particles } from "@/components/public/particles";
import { EntranceScreen } from "@/components/public/entrance";
import { TiltCard } from "@/components/public/tilt-card";
import { ViewTracker } from "@/components/public/view-tracker";
import { VolumeControl } from "@/components/public/volume-control";
import { MusicPlayer, PreviewAutoplay, type MusicTrack } from "@/components/public/music-player";
import { ViewCounterBadge } from "@/components/public/view-counter-badge";
import { CustomCursor } from "@/components/public/custom-cursor";
import { TabTitle } from "@/components/public/tab-title";
import { MediaLock } from "@/components/public/media-lock";
import { ReportButton } from "@/components/public/report-button";
import { BlockRenderer } from "@/components/blocks/renderer";
import { Logo } from "@/components/ui/logo";
import { mediaUrl } from "@/lib/biolinks/public-types";

/**
 * Coque de rendu d'une page publique.
 *
 * Assemble arrière-plan, effets, carte et la suite de blocks. Reçoit une page
 * déjà chargée et déjà déverrouillée : la protection par mot de passe est
 * gérée en amont par la route (voir app/[slug]/page.tsx).
 *
 * `preview` : rendu dans l'éditeur. Trois différences avec la page publique,
 * et trois seulement :
 *   - pas de comptage de vues (l'auteur n'est pas un visiteur) ;
 *   - pas de contrôle de volume flottant ni de musique (l'éditeur a ses
 *     propres réglages) ;
 *   - **jamais d'écran d'entrée** : il masquerait les modifications en cours.
 *     Un signal d'entrée est émis au montage pour que vidéo, particules et
 *     animations démarrent quand même.
 * Tout le reste est strictement identique — c'est ce qui garantit que
 * l'aperçu montre la vraie page et non une approximation.
 */
/**
 * Attribution CC BY : la police « Evil Empire » (Tup Wanders) exige une
 * mention visible dès qu'elle est utilisée sur la page. On la détecte dans la
 * typographie globale, l'écran d'entrée, le compteur de vues et les polices
 * des blocks (y compris titre/sous-titre/bio du block En-tête).
 */
function usesEvilEmpire(theme: ThemeConfig, blocks: PublicBlock[]): boolean {
  const candidates: (string | undefined)[] = [
    theme.typography.fontFamily,
    theme.entranceScreen.fontFamily,
    theme.viewCounter.fontFamily,
  ];
  for (const block of blocks) {
    const config = (block.config ?? {}) as Record<string, unknown>;
    candidates.push(
      typeof config.fontFamily === "string" ? config.fontFamily : undefined,
      typeof config.titleFontFamily === "string" ? config.titleFontFamily : undefined,
      typeof config.subtitleFontFamily === "string" ? config.subtitleFontFamily : undefined,
      typeof config.bioFontFamily === "string" ? config.bioFontFamily : undefined
    );
  }
  return candidates.includes("Evil Empire");
}

export function PageShell({ page, preview = false }: { page: PublicPage; preview?: boolean }) {
  const { theme } = page;
  const cssVars = themeToCssVars(theme);
  // La police custom vit maintenant dans le block En-tête (le pseudo) ; la
  // globale n'accepte plus d'upload. On injecte les deux @font-face : la
  // globale (compat pages anciennes) et celle de l'en-tête.
  const headerConfig = (page.blocks.find((block) => block.type === "header")?.config ?? {}) as {
    customFontUrl?: string;
    customFontName?: string;
  };
  const headerFontFace = headerConfig.customFontUrl
    ? fontFaceRule(
        headerConfig.customFontUrl,
        headerConfig.customFontName ?? fontNameFromUrl(headerConfig.customFontUrl) ?? "AstraCustom"
      )
    : null;
  const fontFace = [customFontFace(theme), headerFontFace].filter(Boolean).join("\n");
  // Pistes de musique : les pistes du thème, ou l'URL historique du thème
  // (pages créées avant l'arrivée de `tracks`), ou un média audio uploadé.
  const tracks: MusicTrack[] =
    theme.audio.tracks.length > 0
      ? theme.audio.tracks
      : theme.audio.url
        ? [{ url: theme.audio.url }]
        : mediaUrl(page, "AUDIO")
          ? [{ url: mediaUrl(page, "AUDIO")! }]
          : [];
  const audioUrl = tracks[0]?.url;
  const tabTitle = page.seoTitle ?? page.title ?? `@${page.owner.username}`;

  // Quand le son vient de la vidéo de fond, pas de lecteur séparé : la vidéo
  // EST la musique (et le bouton de volume suffit).
  const useVideoAudio = theme.background.kind === "video" && theme.background.useVideoAudio;

  // Le lecteur musical est affiché quand la musique custom est activée et
  // qu'aucune vidéo de fond ne fournit le son. Sa position se règle :
  // "card" l'intègre dans la carte (après les blocks), "below" en fait un
  // bloc séparé sous la carte.
  // Seules les pistes avec une URL comptent : une piste vide (« Ajouter une
  // piste » avant upload) ne doit ni afficher le lecteur, ni le faire planter.
  const showPlayer = theme.audio.enabled && tracks.some((track) => track.url) && !useVideoAudio;
  const playerPlacement = theme.audio.placement ?? "below";

  const entrance = theme.effects.entranceAnimation;

  // Le compteur de vues est posé en absolu dans un coin de la carte. Il
  // faut réserver sa place dans le flux du contenu, sinon la pastille
  // chevauche la fin de la bio (ou le lecteur) dans les coins du bas.
  const counterAtTop =
    theme.viewCounter.position === "top-left" || theme.viewCounter.position === "top-right";
  const counterAtBottom =
    theme.viewCounter.position === "bottom-left" ||
    theme.viewCounter.position === "bottom-right" ||
    theme.viewCounter.position === "bottom-center";
  // Police de la pastille : dédiée si choisie, sinon la police de la page.
  const counterFont = resolveFontFamily(
    theme.viewCounter.fontFamily,
    theme.typography.customFontUrl,
    theme.typography.customFontName
  );
  const entranceClass =
    entrance === "slide-up"
      ? "[animation:slide-up_0.6s_ease-out]"
      : entrance === "zoom"
        ? "[animation:zoom-in_0.5s_ease-out]"
        : entrance === "fade"
          ? "[animation:fade-in_0.8s_ease-out]"
          : "";

  const content = (
    <main className={`flex min-h-dvh flex-col items-center justify-center px-4 py-12 ${entranceClass}`}>
      <TiltCard enabled={theme.effects.tiltEnabled} intensity={theme.effects.tiltIntensity}>
        <div
          className={`w-full ${theme.card.animatedBorder ? "astra-beam" : ""}`}
          style={{
            maxWidth: "var(--layout-width)",
            width: "min(100vw - 2rem, var(--layout-width))",
            // La carte combine couleur de fond et opacité : un fond
            // semi-transparent laisse deviner l'arrière-plan à travers, ce qui
            // est l'esthétique attendue de ce type de page.
            backgroundColor: "color-mix(in oklab, var(--card-bg) calc(var(--card-opacity) * 100%), transparent)",
            backdropFilter: "blur(var(--card-blur))",
            borderRadius: "var(--card-radius)",
            border: "var(--card-border-width) solid var(--card-border-color)",
            boxShadow: "var(--card-shadow), var(--card-glow)",
            padding: "1.5rem",
            // Coupe tout débordement du fond (et du filtre d'arrière-plan) aux
            // coins arrondis : sans ça, certains navigateurs peignent un carré
            // visible aux angles. La lueur (box-shadow) n'est pas affectée.
            overflow: "hidden",
            // Ancrage du compteur de vues, posé en absolu dans un coin.
            position: "relative",
          }}
        >
          <div
            className="flex flex-col"
            style={{
              gap: "var(--layout-gap)",
              alignItems: "var(--layout-align)",
              textAlign: "var(--layout-text-align)" as "center" | "left",
              // Réserve la place de la pastille de vues pour qu'elle ne
              // recouvre jamais le contenu (bio, lecteur…) dans les coins.
              paddingTop: counterAtTop ? "2.25rem" : undefined,
              paddingBottom: counterAtBottom ? "2.25rem" : undefined,
            }}
          >
            {/* Bannière : pleine largeur, collée aux bords de la carte. Les
                marges négatives compensent le padding de la carte, et son
                `overflow: hidden` arrondit les coins du haut. */}
            {theme.banner.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.banner.url}
                alt=""
                aria-hidden
                loading="eager"
                className="-mx-6 -mt-6 w-[calc(100%+3rem)] shrink-0 object-cover"
                style={{ height: `${theme.banner.height}px` }}
              />
            )}
            {page.blocks.map((block) => (
              <div key={block.id} className="w-full">
                <BlockRenderer block={block} page={page} theme={theme} />
              </div>
            ))}
            {/* Lecteur intégré à la carte : dernière chose dans le flux des
                blocks, quand le réglage « placement » est sur "card". Il
                occupe toute la largeur du contenu (comme les blocks), avec
                son padding interne : « presque toute la largeur de la carte,
                petit padding ». */}
            {showPlayer && playerPlacement === "card" && (
              <div className="w-full">
                <MusicPlayer theme={theme} tracks={tracks} />
              </div>
            )}
          </div>
          {/* Compteur de vues dans un coin de la carte. Toujours affiché,
              en absolu : il ne prend pas de place dans le flux des blocks.
              Rendu aussi dans l'aperçu de l'éditeur pour un rendu fidèle. */}
          <ViewCounterBadge
            position={theme.viewCounter.position}
            compact={theme.viewCounter.compact}
            fontFamily={counterFont}
            initialUnique={page.uniqueViews}
            initialTotal={page.totalViews}
          />
        </div>
      {/* Lecteur en bloc séparé, sous la carte (réglage « below »). Il est
          DANS le TiltCard : il suit donc l'inclinaison 3D de la carte, comme
          s'il en faisait partie. */}
      {showPlayer && playerPlacement === "below" && (
        <div className="mt-4 w-full" style={{ maxWidth: "var(--layout-width)", width: "min(100vw - 2rem, var(--layout-width))" }}>
          <MusicPlayer theme={theme} tracks={tracks} />
        </div>
      )}
      </TiltCard>

      {/* Le pied de page garde la police du site, pas celle de la page :
          c'est une marque de la plateforme, pas du contenu de l'utilisateur.
          On coupe aussi le halo néon hérité, pour la même raison. En
          pastille (comme le bouton « Créer ma page » de la landing), avec
          l'étoile Astra : au survol, la pastille et l'étoile prennent la
          couleur d'accent du thème. */}
      <a
        href="/"
        className="group mt-6 inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[color-mix(in_oklab,var(--card-bg)_55%,transparent)] px-3.5 py-1.5 text-xs text-[var(--page-muted)] backdrop-blur-md transition-all hover:border-[var(--page-accent)] hover:text-[var(--page-accent)]"
        style={{ fontFamily: "var(--font-sans)", textShadow: "none" }}
      >
        <Logo className="size-3.5 transition-colors group-hover:text-[var(--page-accent)]" />
        créé avec astra
      </a>
      {/* Attribution CC BY requise quand « Evil Empire » est utilisée —
          discrète : petit, muet, à la couleur secondaire de la page. */}
      {usesEvilEmpire(theme, page.blocks) ? (
        <a
          href="https://tupwanders.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 text-[10px] leading-tight transition-opacity hover:opacity-100"
          style={{
            fontFamily: "var(--font-sans)",
            textShadow: "none",
            color: "color-mix(in oklab, var(--page-muted) 65%, transparent)",
          }}
        >
          Police « Evil Empire » par Tup Wanders — licence CC BY
        </a>
      ) : null}
    </main>
  );

  const body: ReactNode = preview ? (
    content
  ) : (
    <EntranceScreen theme={theme}>{content}</EntranceScreen>
  );

  return (
    <div
      className="astra-page relative min-h-dvh"
      style={{
        ...cssVars,
        color: "var(--page-text)",
        fontFamily: "var(--page-font)",
        fontSize: "var(--page-font-size)",
        letterSpacing: "var(--page-letter-spacing)",
        // Le halo néon s'applique à tout le texte de la page par héritage.
        textShadow: "var(--page-text-glow)",
      }}
    >
      {/* Police uploadée : règle @font-face injectée une seule fois, en tête
          de page. Le curseur, lui, est rendu par un composant qui suit la
          souris (voir custom-cursor.tsx). */}
      {fontFace && <style dangerouslySetInnerHTML={{ __html: fontFace }} />}

      <PageBackground background={theme.background} />
      <Particles effects={theme.effects} />
      {!preview && <ViewTracker slug={page.slug} />}
      {!preview && <MediaLock />}
      {/* Le bouton de volume flottant reste pour une vidéo de fond avec son.
          Avec un lecteur de musique affiché, le volume vit DANS le lecteur :
          on retire donc le bouton en haut à gauche. */}
      {!preview && <VolumeControl theme={theme} audioUrl={audioUrl} hide={showPlayer} />}
      {/* Le signalement n'a pas sa place dans l'aperçu de l'éditeur : c'est
          un outil pour les visiteurs, pas pour l'auteur de la page. */}
      {!preview && <ReportButton slug={page.slug} />}
      {theme.cursor.enabled && theme.cursor.url && <CustomCursor cursor={theme.cursor} />}
      {!preview && (
        <TabTitle
          title={tabTitle}
          enabled={theme.effects.tabTitleTypewriter}
          style={theme.effects.tabTitleStyle}
          speed={theme.effects.tabTitleSpeed}
          direction={theme.effects.tabTitleDirection}
        />
      )}
      {preview && <PreviewAutoplay />}

      {body}
    </div>
  );
}
