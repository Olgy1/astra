import type { Metadata } from "next";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Administration — Tableau de bord" };

export default function AdminDashboardPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <p className="mt-1 text-sm text-content-muted">
          Vue d'ensemble de la plateforme : comptes, pages, trafic et modération.
        </p>
      </header>
      <DashboardView />
    </>
  );
}
