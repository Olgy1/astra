import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { EmailVerificationBanner } from "./verification-banner";
import { LogoutButton } from "./logout-button";
import { CreatePageButton } from "./create-page-button";
import { DeletePageButton } from "./delete-page-button";

export const metadata: Metadata = { title: "Mon panel" };

export default async function PanelPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/panel");

  const isAdmin = user.role === "ADMIN";

  const biolinks = await prisma.biolink.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      totalViews: true,
      uniqueViews: true,
      _count: { select: { links: true, blocks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Limite effective de pages : illimité pour un admin (ou quand le compte
  // porte -1), sinon la limite personnalisée du compte (ou 1 par défaut).
  const pageLimit = isAdmin ? null : user.pageLimit === -1 ? null : (user.pageLimit ?? 1);
  const canCreateMore = pageLimit === null || biolinks.length < pageLimit;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bonjour {user.username}</h1>
          <p className="mt-1 text-sm text-content-muted">{isAdmin ? "Administrateur" : "Membre"}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin" className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-surface-3">
              Panel admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>

      {!user.emailVerified && <EmailVerificationBanner email={user.email} />}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Mes pages</h2>
          {canCreateMore && <CreatePageButton suggestedSlug={user.username} />}
        </div>

        {biolinks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface-1 p-8 text-center">
            <p className="text-sm text-content-secondary">Vous n&apos;avez pas encore de page.</p>
            <p className="mt-1 text-xs text-content-muted">
              Créez-en une pour commencer à la personnaliser.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {biolinks.map((biolink) => (
              <li key={biolink.id}>
                <div className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-1 p-4 transition-colors hover:border-border-strong">
                  <Link href={`/panel/edit/${biolink.id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-medium">astraa.is-cool.dev/{biolink.slug}</p>
                    <p className="mt-0.5 text-xs text-content-muted">
                      {biolink._count.links} liens · {biolink._count.blocks} blocks · {biolink.uniqueViews}{" "}
                      {biolink.uniqueViews === 0 || biolink.uniqueViews === 1 ? "vue unique" : "vues uniques"}
                    </p>
                  </Link>
                  <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs sm:inline ${biolink.isPublished ? "bg-success/15 text-success" : "bg-surface-3 text-content-muted"}`}>
                    {biolink.isPublished ? "En ligne" : "Brouillon"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/panel/stats/${biolink.id}`}
                      className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3"
                    >
                      Statistiques
                    </Link>
                    <DeletePageButton id={biolink.id} slug={biolink.slug} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-content-muted">
          {pageLimit === null
            ? `${biolinks.length} page(s) · illimité`
            : `${biolinks.length} / ${pageLimit} page${pageLimit > 1 ? "s" : ""}`}
        </p>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-1 p-6">
        <h2 className="text-sm font-medium">Compte</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-content-secondary">
          <li className="flex items-center justify-between">
            <span>Adresse email</span>
            <span className={user.emailVerified ? "text-success" : "text-warning"}>
              {user.emailVerified ? "Confirmée" : "Non confirmée"}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span>Double authentification</span>
            <span className={user.twoFactorEnabled ? "text-success" : "text-content-muted"}>
              {user.twoFactorEnabled ? "Active" : "Inactive"}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <Link href="/panel/settings" className="text-accent hover:underline">
              Paramètres du compte
            </Link>
            <span />
          </li>
        </ul>
      </section>
    </main>
  );
}
