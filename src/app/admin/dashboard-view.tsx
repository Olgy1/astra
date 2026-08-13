"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

type Stats = {
  totals: {
    users: number;
    activeUsers: number;
    suspended: number;
    banned: number;
    admins: number;
    biolinks: number;
    publishedBiolinks: number;
    pendingReports: number;
    totalViews: number;
    uniqueViews: number;
    signupsLast7: number;
  };
  signupsByDay: { date: string; count: number }[];
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = () => {
    api.get<Stats>("/api/admin/stats").then((result) => {
      if (result.ok) setStats(result.data);
      else setError(result.message);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const resetStats = async () => {
    if (
      !window.confirm(
        "Réinitialiser à 0 toutes les statistiques de vues et visites de la plateforme ? Les compteurs de chaque page et les données journalières seront définitivement effacés."
      )
    )
      return;
    setResetting(true);
    setError(null);
    setNotice(null);
    const result = await api.post<{ message?: string }>("/api/admin/stats/reset", {});
    setResetting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Statistiques réinitialisées.");
    load();
  };

  if (error) {
    return (
      <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </p>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  const { totals } = stats;
  const maxSignups = Math.max(1, ...stats.signupsByDay.map((day) => day.count));

  const cards = [
    { label: "Utilisateurs", value: formatNumber(totals.users), accent: false },
    { label: "Comptes actifs", value: formatNumber(totals.activeUsers), accent: false },
    { label: "Pages publiées", value: formatNumber(totals.publishedBiolinks), accent: false },
    { label: "Pages au total", value: formatNumber(totals.biolinks), accent: false },
    { label: "Vues (cumul)", value: formatNumber(totals.totalViews), accent: true },
    { label: "Visiteurs uniques", value: formatNumber(totals.uniqueViews), accent: true },
    { label: "Inscriptions (7 j)", value: formatNumber(totals.signupsLast7), accent: false },
    { label: "Signalements en attente", value: formatNumber(totals.pendingReports), accent: totals.pendingReports > 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 ${
              card.accent
                ? "border-accent/40 bg-accent-muted/60"
                : "border-border-subtle bg-surface-1"
            }`}
          >
            <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="mt-1 text-xs text-content-muted">{card.label}</p>
          </div>
        ))}
      </section>

      {(notice || error) && (
        <p
          className={`rounded-xl border p-3 text-sm ${
            notice
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {notice ?? error}
        </p>
      )}

      <section className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4">
        <div>
          <p className="text-sm font-medium">Statistiques de vues et visites</p>
          <p className="mt-0.5 text-xs text-content-muted">
            Réinitialise à zéro les compteurs de toutes les pages, les données journalières
            et les visites uniques. Action définitive et journalisée.
          </p>
        </div>
        <button
          type="button"
          disabled={resetting}
          onClick={resetStats}
          className="shrink-0 rounded-lg bg-warning/15 px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/25 disabled:opacity-50"
        >
          {resetting ? "Réinitialisation…" : "Réinitialiser les stats"}
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
          <h2 className="text-sm font-medium">Inscriptions — 14 derniers jours</h2>
          {stats.signupsByDay.every((day) => day.count === 0) ? (
            <p className="mt-3 text-sm text-content-muted">Aucune inscription sur la période.</p>
          ) : (
            <div className="mt-4 flex h-32 items-end gap-1">
              {stats.signupsByDay.map((day) => (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col justify-end"
                  title={`${day.date} : ${day.count} inscription(s)`}
                >
                  <div
                    className="w-full rounded-t bg-accent/70 transition-colors group-hover:bg-accent"
                    style={{ height: `${Math.max(3, (day.count / maxSignups) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
          <h2 className="text-sm font-medium">État de la plateforme</h2>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-content-secondary">Comptes suspendus</span>
              <span className="tabular-nums text-warning">{formatNumber(totals.suspended)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-content-secondary">Comptes bannis</span>
              <span className="tabular-nums text-danger">{formatNumber(totals.banned)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-content-secondary">Administrateurs</span>
              <span className="tabular-nums">{formatNumber(totals.admins)}</span>
            </li>
          </ul>

          {totals.pendingReports > 0 && (
            <Link
              href="/admin/reports"
              className="mt-4 block rounded-xl bg-danger/10 p-3 text-xs text-danger transition-colors hover:bg-danger/20"
            >
              {totals.pendingReports} signalement(s) en attente de modération →
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
