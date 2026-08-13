import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ReportForm } from "./report-form";
import { StopMedia } from "./stop-media";

type Props = { params: Promise<{ slug: string }> };

// La page de signalement lit la base à chaque requête (le slug doit rester
// valide même après une suppression) : on interdit la statification.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Signaler — ${slug}`,
    // Un formulaire de signalement ne doit pas être indexé.
    robots: { index: false, follow: false },
  };
}

/**
 * Page de signalement `astra.is-a.dev/[slug]/report`.
 *
 * Accessible depuis le bouton flottant de la page bio. Ne demande aucune
 * connexion : n'importe quel visiteur peut signaler une page, le commentaire
 * est transmis à la modération (voir /api/public/:slug/report).
 */
export default async function ReportPage({ params }: Props) {
  const { slug } = await params;
  const biolink = await prisma.biolink.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true, slug: true, isPublished: true },
  });

  // Même règle que la page elle-même : une page absente ou non publiée n'a
  // pas de page de signalement — elle n'est pas visible, donc pas signalable.
  if (!biolink || !biolink.isPublished) notFound();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* La page de signalement doit être silencieuse : on coupe tout média
          qui aurait survécu à la navigation depuis la page bio. */}
      <StopMedia />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[120px]"
      />

      <div className="relative w-full max-w-md">
        <ReportForm slug={biolink.slug} />
      </div>
    </main>
  );
}
