import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getPublicPage } from "@/lib/biolinks/public";
import { unlockCookieName, verifyUnlockToken } from "@/lib/biolinks/unlock";
import { PageShell } from "@/components/public/page-shell";
import { PasswordGate } from "@/components/public/password-gate";
import { SuspendedGate } from "@/components/public/suspended-gate";

type Props = { params: Promise<{ slug: string }> };

/** La page est-elle sous suspension active ? */
function isSuspended(page: { suspendedUntil: string | null }): boolean {
  return Boolean(page.suspendedUntil && new Date(page.suspendedUntil) > new Date());
}

/**
 * Page publique `astraa.is-cool.dev/[slug]`.
 *
 * Rendue côté serveur : le contenu est dans le HTML initial, indexable et
 * partageable. Les effets (particules, tilt, compteurs) sont des îlots
 * client par-dessus.
 */

/**
 * Métadonnées SEO et Open Graph.
 *
 * `generateMetadata` s'exécute en parallèle du rendu ; `getPublicPage` est
 * caché, donc les deux appels ne touchent la base qu'une fois.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicPage(slug);

  if (!page) {
    return { title: "Page introuvable" };
  }

  const title = page.seoTitle ?? page.title ?? `@${page.owner.username}`;
  const description =
    page.seoDescription ?? page.description ?? `La page de ${page.owner.username} sur Astra.`;

  return {
    // Titre absolu : la page bio ne porte pas le suffixe « · Astra » du
    // gabarit racine — le titre d'onglet, c'est la page, rien d'autre.
    title: { absolute: title },
    description,
    // Un contenu protégé ou sensible ne doit pas être indexé ni pré-visualisé.
    robots: page.isPasswordProtected || isSuspended(page) ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      type: "profile",
      images: page.ogImageUrl ? [{ url: page.ogImageUrl }] : undefined,
      url: `/${page.slug}`,
    },
    twitter: {
      card: page.ogImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: page.ogImageUrl ? [page.ogImageUrl] : undefined,
    },
  };
}

export default async function PublicBiolinkPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublicPage(slug);

  // notFound() couvre les trois cas indistinctement : page absente, non
  // publiée, propriétaire banni. Un message différencié renseignerait sur
  // l'état d'un compte tiers.
  if (!page) notFound();

  // Suspension de modération : la page n'est pas rendue du tout, elle affiche
  // l'écran « page suspendue » jusqu'à la date. Le contenu reste donc hors
  // de portée — c'est la même garantie que la protection par mot de passe.
  if (isSuspended(page)) {
    return (
      <SuspendedGate slug={page.slug} reason={page.suspensionReason} until={page.suspendedUntil} />
    );
  }

  // Protection par mot de passe : le contenu n'est jamais rendu sans un jeton
  // de déverrouillage valide. La vérification est côté serveur — masquer le
  // contenu en CSS le laisserait dans le HTML, à portée d'un clic droit.
  if (page.isPasswordProtected) {
    const store = await cookies();
    const token = store.get(unlockCookieName(page.id))?.value;

    if (!verifyUnlockToken(page.id, token)) {
      return <PasswordGate slug={page.slug} />;
    }
  }

  return <PageShell page={page} />;
}
