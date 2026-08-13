import type { Metadata } from "next";
import { BiolinksView } from "./biolinks-view";

export const metadata: Metadata = { title: "Administration — Pages" };

export default function AdminBiolinksPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Pages</h1>
        <p className="mt-1 text-sm text-content-muted">
          Toutes les pages de la plateforme : dépublication, réinitialisation des statistiques, suppression.
        </p>
      </header>
      <BiolinksView />
    </>
  );
}
