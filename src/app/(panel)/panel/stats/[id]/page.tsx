import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Statistiques" };

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  // La propriété est vérifiée ici (serveur) et encore dans l'API : un
  // utilisateur ne peut pas lire les stats d'une page qui ne lui appartient pas.
  const biolink = await prisma.biolink.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, slug: true },
  });

  if (!biolink) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <Link href="/panel" className="text-content-muted hover:text-content-primary" aria-label="Retour">
          <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
        </Link>
        <h1 className="text-xl font-semibold">Statistiques</h1>
      </header>

      <StatsView biolinkId={biolink.id} slug={biolink.slug} />
    </main>
  );
}
