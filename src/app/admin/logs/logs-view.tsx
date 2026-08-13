"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type LogRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
  admin: { id: string; username: string };
};

type ListResponse = {
  logs: LogRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const ACTION_LABELS: Record<string, string> = {
  "user.role": "Changement de rôle",
  "user.page_limit": "Changement de limite de pages",
  "user.ban": "Bannissement",
  "user.suspend": "Suspension",
  "user.unban": "Levée de sanction",
  "user.reset_password": "Reset de mot de passe",
  "user.revoke_sessions": "Révocation de sessions",
  "biolink.create_for": "Création de page (tiers)",
  "biolink.moderate": "Modération de page",
  "biolink.delete": "Suppression de page",
  "biolink.reset_stats": "Réinitialisation des statistiques",
  "stats.reset": "Réinitialisation globale des statistiques",
  "report.resolve": "Traitement de signalement",
  "slug.reserve": "Réservation de slug",
  "slug.release": "Libération de slug",
  "slug.blacklist.add": "Ajout à la blacklist",
  "slug.blacklist.remove": "Retrait de la blacklist",
};

function describe(log: LogRow): string {
  const label = ACTION_LABELS[log.action] ?? log.action.replaceAll(".", " ");
  const target =
    log.targetType === "user"
      ? (log.metadata.username as string | undefined)
      : log.targetType === "biolink"
        ? (log.metadata.slug as string | undefined)
        : log.targetType === "slug"
          ? log.targetId
          : undefined;

  return target ? `${label} — ${target}` : label;
}

export function LogsView() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "30" });
    if (action.trim()) params.set("action", action.trim());

    api.get<ListResponse>(`/api/admin/logs?${params}`).then((result) => {
      if (result.ok) setData(result.data);
      else setError(result.message);
    });
  }, [action, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-content-muted">
          Journal d'audit en lecture seule : aucune entrée ne peut être supprimée.
        </p>
        <input
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          placeholder="Filtrer par action (ex: user.ban)"
          className="w-64 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      {!data && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="overflow-hidden rounded-2xl border border-border-subtle">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/60 text-xs text-content-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Admin</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Détails</th>
                  <th className="px-4 py-2.5 font-medium">Quand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-content-muted">
                      Aucune entrée dans le journal.
                    </td>
                  </tr>
                )}
                {data.logs.map((log) => (
                  <tr key={log.id} className="bg-surface-1/60 transition-colors hover:bg-surface-1">
                    <td className="px-4 py-3">
                      <span className="font-medium">{describe(log)}</span>
                      <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[10px] text-content-muted">
                        {log.action}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-content-secondary sm:table-cell">
                      {log.admin.username}
                    </td>
                    <td className="hidden max-w-64 truncate px-4 py-3 text-xs text-content-muted md:table-cell">
                      {log.ipAddress ? `IP ${log.ipAddress}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-content-muted">
                      {new Date(log.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-content-muted">
            <span>
              {data.pagination.total} entrée(s) — page {data.pagination.page} sur {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                ← Précédent
              </button>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-1.5 transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
