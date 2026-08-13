import type { Metadata } from "next";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Administration — Modération" };

export default function AdminReportsPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Modération</h1>
        <p className="mt-1 text-sm text-content-muted">
          Signalements de pages : contenu sensible non déclaré, liens suspects,
          usurpation. Traitez la file pour la vider.
        </p>
      </header>
      <ReportsView />
    </>
  );
}
