import type { Metadata } from "next";
import { LogsView } from "./logs-view";

export const metadata: Metadata = { title: "Administration — Journal" };

export default function AdminLogsPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Journal d'audit</h1>
        <p className="mt-1 text-sm text-content-muted">
          Toutes les actions admin critiques, horodatées et tracées par admin.
        </p>
      </header>
      <LogsView />
    </>
  );
}
