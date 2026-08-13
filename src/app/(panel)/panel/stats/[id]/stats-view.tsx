"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Stats = {
  totalViews: number;
  periodViews: number;
  periodUniqueViews: number;
  timeline: { date: string; views: number; uniqueViews: number }[];
  linksByClicks: { id: string; label: string; clicks: number }[];
  referrers: { label: string; value: number }[];
  devices: { label: string; value: number }[];
  countries: { label: string; value: number }[];
};

const RANGES = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
] as const;

/** Formate un nombre : 1 234 567 → « 1,2 M ». */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")} k`;
  return String(value);
}

/** Libellé français d'une provenance : inconnue ou URL raccourcie. */
function labelOf(referrer: string): string {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

export function StatsView({ biolinkId, slug }: { biolinkId: string; slug: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<Stats>(`/api/me/stats?biolinkId=${biolinkId}&range=${range}`).then((result) => {
      if (cancelled) return;
      if (result.ok) setStats(result.data);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [biolinkId, range]);

  const maxViews = Math.max(1, ...(stats?.timeline.map((point) => point.views) ?? [1]));
  const maxClicks = Math.max(1, ...(stats?.linksByClicks.map((link) => link.clicks) ?? [1]));
  const maxSource = Math.max(1, ...(stats?.referrers.map((entry) => entry.value) ?? [1]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-content-muted">
          Statistiques de <span className="font-medium text-content-primary">astra.is-a.dev/{slug}</span>
        </p>
        <div className="flex rounded-lg border border-border-subtle bg-surface-1 p-0.5">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                range === option.value ? "bg-accent text-white" : "text-content-muted hover:text-content-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      {!stats && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Vues au total", value: stats.totalViews },
              { label: "Vues (période)", value: stats.periodViews },
              { label: "Visiteurs uniques", value: stats.periodUniqueViews },
              { label: "Clics sur liens", value: stats.linksByClicks.reduce((sum, link) => sum + link.clicks, 0) },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <p className="text-2xl font-semibold tabular-nums">{formatCompact(card.value)}</p>
                <p className="mt-1 text-xs text-content-muted">{card.label}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
            <h2 className="text-sm font-medium">Évolution des vues</h2>
            {stats.timeline.length === 0 ? (
              <p className="mt-3 text-sm text-content-muted">Aucune vue sur cette période.</p>
            ) : (
              <div className="mt-4 flex h-40 items-end gap-1">
                {stats.timeline.map((point) => (
                  <div
                    key={point.date}
                    className="group relative flex flex-1 flex-col justify-end"
                    title={`${point.date} : ${point.views} ${point.views === 0 || point.views === 1 ? "vue" : "vues"}`}
                  >
                    <div
                      className="w-full rounded-t bg-accent/70 transition-colors hover:bg-accent"
                      style={{ height: `${Math.max(3, (point.views / maxViews) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-right text-xs text-content-muted">
              {stats.timeline.length > 0 ? `${stats.timeline.length} jour(s) affichés` : ""}
            </p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
              <h2 className="text-sm font-medium">Clics par lien</h2>
              {stats.linksByClicks.length === 0 ? (
                <p className="mt-3 text-sm text-content-muted">Aucun lien sur cette page.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {stats.linksByClicks.map((link) => (
                    <li key={link.id} className="flex items-center gap-3">
                      <span className="w-0 flex-1 truncate text-sm">{link.label}</span>
                      <span className="w-10 text-right text-xs tabular-nums text-content-muted">{link.clicks}</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(2, (link.clicks / maxClicks) * 100)}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
              <h2 className="text-sm font-medium">Provenance du trafic</h2>
              {stats.referrers.length === 0 ? (
                <p className="mt-3 text-sm text-content-muted">Aucune donnée sur cette période.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {stats.referrers.map((entry) => (
                    <li key={entry.label} className="flex items-center gap-3">
                      <span className="w-0 flex-1 truncate text-sm">{labelOf(entry.label)}</span>
                      <span className="w-10 text-right text-xs tabular-nums text-content-muted">{entry.value}</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(2, (entry.value / maxSource) * 100)}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {stats.devices.length > 0 && (
              <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <h2 className="text-sm font-medium">Appareils</h2>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {stats.devices.map((entry) => (
                    <li key={entry.label} className="flex items-center justify-between">
                      <span className="text-content-secondary">{entry.label}</span>
                      <span className="tabular-nums">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stats.countries.length > 0 && (
              <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <h2 className="text-sm font-medium">Pays</h2>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {stats.countries.slice(0, 8).map((entry) => (
                    <li key={entry.label} className="flex items-center justify-between">
                      <span className="text-content-secondary">{entry.label}</span>
                      <span className="tabular-nums">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
