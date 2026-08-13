import { requireAdmin } from "@/lib/auth/context";
import { EmailsView } from "@/app/admin/emails/emails-view";

export const metadata = { title: "Emails — Administration" };

export default async function EmailsPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Historique des emails</h1>
        <p className="mt-1 text-sm text-content-muted">
          Chaque email envoyé par le système : destinataire, type, statut et erreur éventuelle. Aucun contenu ni token n&apos;est stocké.
        </p>
      </div>
      <EmailsView />
    </div>
  );
}
