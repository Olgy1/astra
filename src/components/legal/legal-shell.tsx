import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";

/**
 * Coque des pages légales (mentions légales, confidentialité, CGU).
 *
 * Reprend la structure de la landing publique (glow, header, footer) pour
 * que les pages juridiques ne ressemblent pas à des pages administratives :
 * même typographie, mêmes couleurs, même header, même footer, responsive.
 */

/** En-tête identique à la landing : logo, connexion, création de page. */
function LegalHeader() {
  return (
    <header className="flex items-center justify-between py-6">
      <Link href="/" className="transition-opacity hover:opacity-80">
        <Wordmark className="text-lg" />
      </Link>

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
  );
}

/** Footer public : copyright + liens juridiques (pas de page « cookies »). */
export function LegalFooter() {
  return (
    <footer className="border-t border-border-subtle py-8">
      <p className="text-center text-xs text-content-muted">
        © {new Date().getFullYear()} Astra
      </p>
      <nav
        aria-label="Liens juridiques"
        className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-content-muted"
      >
        <Link href="/legal" className="transition-colors hover:text-content-primary">
          Mentions légales
        </Link>
        <Link href="/privacy" className="transition-colors hover:text-content-primary">
          Confidentialité
        </Link>
        <Link href="/terms" className="transition-colors hover:text-content-primary">
          Conditions d&apos;utilisation
        </Link>
      </nav>
    </footer>
  );
}

export function LegalShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Lueur d'ambiance, identique à la landing. aria-hidden : décoratif. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/20 blur-[120px]"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col px-6">
        <LegalHeader />
        <div className="flex flex-col gap-6 pb-16">{children}</div>
        <LegalFooter />
      </div>
    </main>
  );
}

/** Titre de page. */
export function LegalTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{children}</h1>;
}

/** Petite intro sous le titre. */
export function LegalIntro({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-content-secondary">{children}</p>;
}

/** Une section encartée (carte surface-1), comme les sections de la landing. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-1 p-5 sm:p-6">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-content-secondary">
        {children}
      </div>
    </section>
  );
}

/** Paragraphe courant. */
export function LegalP({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

/** Liste à puces. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
