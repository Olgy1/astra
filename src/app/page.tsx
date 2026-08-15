import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { LegalFooter } from "@/components/legal/legal-shell";
import { listBlockDefinitions } from "@/lib/blocks/registry";

/**
 * Landing publique.
 *
 * Le catalogue de blocks est lu depuis le registry plutôt que réécrit ici :
 * ajouter un widget le fait apparaître sur la landing sans y toucher.
 */
export default function HomePage() {
  const blocks = listBlockDefinitions();

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Lueur d'ambiance. aria-hidden : purement décoratif. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/20 blur-[120px]"
      />

      <div className="relative mx-auto flex max-w-5xl flex-col px-6">
        <header className="flex items-center justify-between py-6">
          <Wordmark className="text-lg" />

          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Créer ma page
            </Link>
          </nav>
        </header>

        <section className="flex flex-col items-center py-20 text-center sm:py-28">
          <h1 className="max-w-2xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Tous vos liens.{" "}
            <span className="bg-gradient-to-r from-accent to-fuchsia-400 bg-clip-text text-transparent">
              Une seule page.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-lg text-content-secondary">
            Votre page, à votre image, en deux minutes. 43 polices intégrées,
            animations de texte, musique, effets visuels et bien plus…
          </p>

          <div className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-border-subtle bg-surface-1 px-5 py-4 focus-within:border-accent">
              <span className="shrink-0 select-none whitespace-nowrap text-base text-content-muted">
                astra.is-a.dev/
              </span>
              <input
                type="text"
                name="slug"
                placeholder="pseudo"
                autoComplete="off"
                aria-label="Choisissez votre lien"
                className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-content-muted"
              />
            </div>
            <Link
              href="/register"
              className="rounded-xl bg-accent px-7 py-4 text-center text-base font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Réserver
            </Link>
          </div>

          <p className="mt-4 text-xs text-content-muted">
            Gratuit, sans carte bancaire.
          </p>
        </section>

        <section className="pb-24">
          <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-content-muted">
            Une page, mille possibilités
          </h2>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Polices & typographie", desc: "43 polices intégrées, upload d'une police personnalisée, taille et police réglables par zone (titre, sous-titre, bio)." },
              { title: "Animations", desc: "Titre, bio et onglet animés : machine à écrire, glitch, vague, défilement, scintillement…" },
              { title: "Musique", desc: "Lecteur multi-pistes intégré à la carte, lecture auto, volume, piste suivante / précédente." },
              { title: "Arrière-plans", desc: "Dégradé, image ou vidéo de fond, avec flou et assombrissement réglables." },
              { title: "Effets visuels", desc: "Particules, traînée de curseur, inclinaison 3D de la carte, écran d'entrée." },
              { title: "Statistiques", desc: "Compteur de vues intégré à la carte et tableau de bord de statistiques." },
            ].map((feature) => (
              <li key={feature.title} className="rounded-xl border border-border-subtle bg-surface-1 p-4">
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-content-muted">{feature.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="pb-24">
          <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-content-muted">
            {blocks.length} blocks à assembler
          </h2>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {blocks.map((block) => (
              <li
                key={block.type}
                className="rounded-xl border border-border-subtle bg-surface-1 p-4 transition-colors hover:border-border-strong"
              >
                <p className="text-sm font-medium">{block.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-content-muted">
                  {block.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <LegalFooter />
      </div>
    </main>
  );
}
