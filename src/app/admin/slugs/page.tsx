import type { Metadata } from "next";
import { SlugsView } from "./slugs-view";

export const metadata: Metadata = { title: "Administration — Slugs" };

export default function AdminSlugsPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Slugs</h1>
        <p className="mt-1 text-sm text-content-muted">
          Liste de mots réservés et slugs premium. Un slug réservé est interdit
          partout ; un slug premium n'est attribuable que par un admin.
        </p>
      </header>
      <SlugsView />
    </>
  );
}
