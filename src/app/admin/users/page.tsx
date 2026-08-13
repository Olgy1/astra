import type { Metadata } from "next";
import { UsersView } from "./users-view";

export const metadata: Metadata = { title: "Administration — Utilisateurs" };

export default function AdminUsersPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Utilisateurs</h1>
        <p className="mt-1 text-sm text-content-muted">
          Recherche, bannissement, suspension, changement de rôle. Cliquez sur un
          pseudo pour la fiche complète.
        </p>
      </header>
      <UsersView />
    </>
  );
}
