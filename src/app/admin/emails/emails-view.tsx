"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type EmailRow = {
  id: string;
  email: string;
  type: string;
  status: "PENDING" | "SENT" | "FAILED";
  subject: string | null;
  providerMessageId: string | null;
  error: string | null;
  createdAt: string;
  user: { id: string; username: string } | null;
};

type ListResponse = {
  emails: EmailRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const TYPE_LABELS: Record<string, string> = {
  EMAIL_VERIFICATION: "Vérification email",
  PASSWORD_RESET: "Réinitialisation du mot de passe",
  PASSWORD_CHANGED: "Mot de passe modifié",
  ACCOUNT_SUSPENDED: "Compte suspendu",
  ACCOUNT_UNSUSPENDED: "Suspension levée",
  TWO_FACTOR_CHANGED: "Double authentification",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SENT: "Envoyé",
  FAILED: "Échec",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-500",
  SENT: "bg-emerald-500/15 text-emerald-500",
  FAILED: "bg-danger/15 text-danger",
};

export function EmailsView() {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "30" });
    if (type.trim()) params.set("type", type.trim());
    if (status) params.set("status", status);

    api.get<ListResponse>(`/api/admin/emails?${params}`).then((result) => {
      if (result.ok) setData(result.data);
      else setError(result.message);
    });
  }, [type, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <input
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            placeholder="Filtrer par type (ex: PASSWORD_RESET)"
            className="w-56 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value="">Tous les statuts</option>
            <option value="SENT">Envoyé</option>
            <option value="FAILED">Échec</option>
            <option value="PENDING">En attente</option>
          </select>
        </div>
        <p className="text-sm text-content-muted">
          Historique en lecture seule : les emails ne peuvent pas être supprimés.
        </p>
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
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Destinataire</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Sujet</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium">Quand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.emails.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-content-muted">
                      Aucun email dans l&apos;historique.
                    </td>
                  </tr>
                )}
                {data.emails.map((email) => (
                  <tr key={email.id} className="bg-surface-1/60 transition-colors hover:bg-surface-1">
                    <td className="px-4 py-3">
                      <span className="font-medium">{TYPE_LABELS[email.type] ?? email.type}</span>
                      {email.user && (
                        <span className="ml-2 text-xs text-content-muted">@{email.user.username}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-content-secondary">{email.email}</td>
                    <td className="hidden max-w-64 truncate px-4 py-3 text-xs text-content-muted md:table-cell">
                      {email.subject ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[email.status]}`}
                        title={email.error ?? undefined}
                      >
                        {STATUS_LABELS[email.status]}
                      </span>
                      {email.status === "FAILED" && email.error && (
                        <p className="mt-1 max-w-64 truncate text-[11px] text-danger/80">{email.error}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-content-muted">
                      {new Date(email.createdAt).toLocaleString("fr-FR", {
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
              {data.pagination.total} email(s) — page {data.pagination.page} sur {data.pagination.totalPages}
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
