import type { ReactNode } from "react";
import type { PublicPage } from "@/lib/biolinks/public-types";
import { themeToCssVars, customFontFace } from "@/lib/theme/css";
import { PageBackground } from "@/components/public/background";
import { Particles } from "@/components/public/particles";
import { EntranceScreen } from "@/components/public/entrance";
import { TiltCard } from "@/components/public/tilt-card";
import { ViewTracker } from "@/components/public/view-tracker";
import { VolumeControl } from "@/components/public/volume-control";
import { PageAudio, PreviewAutoplay } from "@/components/public/page-audio";
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
export function PageShell({ page, preview = false }: { page: PublicPage; preview?: boolean }) {
  const { theme } = page;
  const cssVars = themeToCssVars(theme);
  const fontFace = customFontFace(theme);
  const audioUrl = theme.audio.url ?? mediaUrl(page, "AUDIO");
  const tabTitle = page.seoTitle ?? page.title ?? `@${page.owner.username}`;

  const entrance = theme.effects.entranceAnimation;
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
          }}
        >
          <div
            className="flex flex-col"
            style={{ gap: "var(--layout-gap)", alignItems: "var(--layout-align)", textAlign: "var(--layout-text-align)" as "center" | "left" }}
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
          </div>
        </div>
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
      {!preview && <VolumeControl theme={theme} audioUrl={audioUrl} />}
      {!preview && theme.audio.enabled && audioUrl && <PageAudio theme={theme} audioUrl={audioUrl} />}
      {/* Le signalement n'a pas sa place dans l'aperçu de l'éditeur : c'est
          un outil pour les visiteurs, pas pour l'auteur de la page. */}
      {!preview && <ReportButton slug={page.slug} />}
      {theme.cursor.enabled && theme.cursor.url && <CustomCursor cursor={theme.cursor} />}
      {!preview && (
        <TabTitle
          title={tabTitle}
          enabled={theme.effects.tabTitleTypewriter}
          speed={theme.effects.tabTitleSpeed}
        />
      )}
      {preview && <PreviewAutoplay />}

      {body}
    </div>
  );
}
