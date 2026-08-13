"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  pageLimit: number | null;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  emailVerified: boolean;
  discordUsername: string | null;
  createdAt: string;
  lastLogin: string | null;
  _count: { biolinks: number; sessions: number };
};

type ListResponse = {
  users: UserRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_LABELS: Record<UserRow["status"], string> = {
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  BANNED: "Banni",
};

const STATUS_STYLES: Record<UserRow["status"], string> = {
  ACTIVE: "bg-success/15 text-success",
  SUSPENDED: "bg-warning/15 text-warning",
  BANNED: "bg-danger/15 text-danger",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function UsersView() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN" | "">("");
  const [status, setStatus] = useState<UserRow["status"] | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Édition de la limite de pages : la ligne en cours d'édition et le
  // brouillon saisi.
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState("1");

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query.trim()) params.set("q", query.trim());
    if (role) params.set("role", role);
    if (status) params.set("status", status);

    api.get<ListResponse>(`/api/admin/users?${params}`).then((result) => {
      if (result.ok) setData(result.data);
      else setError(result.message);
    });
  }, [query, role, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (
    userId: string,
    path: string,
    body?: unknown,
    refresh = true,
    method: "POST" | "PATCH" | "DELETE" = "POST",
    successMessage = "Action effectuée."
  ): Promise<boolean> => {
    setBusy(userId);
    setError(null);
    setNotice(null);
    const result = await api[method.toLowerCase() as "post" | "patch" | "delete"]<{ message?: string }>(path, body);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    if (refresh) load();
    setNotice(successMessage);
    return true;
  };

  const startEditLimit = (user: UserRow) => {
    setEditingLimit(user.id);
    setLimitDraft(String(user.pageLimit ?? 1));
  };

  const saveLimit = async (user: UserRow) => {
    const value = Number.parseInt(limitDraft, 10);
    if (!Number.isInteger(value) || value < 1) {
      setError("La limite doit être un nombre entier d'au moins 1.");
      return;
    }
    const ok = await runAction(
      user.id,
      `/api/admin/users/${user.id}/limit`,
      { pageLimit: value },
      true,
      "PATCH",
      `Limite de ${user.username} fixée à ${value} page${value > 1 ? "s" : ""}.`
    );
    if (ok) setEditingLimit(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher un pseudo, un email, un Discord…"
          className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as typeof role);
              setPage(1);
            }}
            className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Tous les rôles</option>
            <option value="MEMBER">Membre</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="SUSPENDED">Suspendu</option>
            <option value="BANNED">Banni</option>
          </select>
        </div>
      </div>

      {notice && (
        <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</p>
      )}
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      {!data && !error && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="overflow-hidden rounded-2xl border border-border-subtle">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/60 text-xs text-content-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Utilisateur</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Inscrit</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Pages</th>
                  <th className="px-4 py-2.5 font-medium">Rôle</th>
                  <th className="px-4 py-2.5 font-medium">Limite</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-content-muted">
                      Aucun utilisateur ne correspond à cette recherche.
                    </td>
                  </tr>
                )}
                {data.users.map((user) => (
                  <tr key={user.id} className="bg-surface-1/60 transition-colors hover:bg-surface-1">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${user.id}`} className="block">
                        <span className="font-medium text-content-primary hover:text-accent">
                          {user.username}
                        </span>
                        <span className="block max-w-56 truncate text-xs text-content-muted">
                          {user.email}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-content-muted md:table-cell">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="hidden px-4 py-3 text-xs tabular-nums sm:table-cell">
                      {user._count.biolinks}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busy === user.id}
                        onClick={() =>
                          runAction(
                            user.id,
                            `/api/admin/users/${user.id}/role`,
                            { role: user.role === "ADMIN" ? "MEMBER" : "ADMIN" },
                            true,
                            "PATCH",
                            user.role === "ADMIN"
                              ? `${user.username} est redonné membre.`
                              : `${user.username} est promu admin : il accède maintenant au panel admin.`
                          )
                        }
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${
                          user.role === "ADMIN" ? "bg-accent-muted text-accent" : "bg-surface-3 text-content-secondary"
                        }`}
                        title="Cliquer pour changer le rôle"
                      >
                        {user.role === "ADMIN" ? "Admin" : "Membre"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {user.role === "ADMIN" ? (
                        <span className="text-xs text-content-muted">Illimité</span>
                      ) : editingLimit === user.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={limitDraft}
                            autoFocus
                            onChange={(event) => setLimitDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveLimit(user);
                              if (event.key === "Escape") setEditingLimit(null);
                            }}
                            className="w-16 rounded-lg border border-border-subtle bg-surface-1 px-2 py-1 text-xs outline-none focus:border-accent"
                            aria-label={`Limite de pages de ${user.username}`}
                          />
                          <button
                            type="button"
                            disabled={busy === user.id}
                            onClick={() => saveLimit(user)}
                            className="rounded-md bg-success/15 px-1.5 py-1 text-xs text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                            title="Enregistrer"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLimit(null)}
                            className="rounded-md bg-surface-2 px-1.5 py-1 text-xs text-content-muted transition-colors hover:bg-surface-3"
                            title="Annuler"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === user.id}
                          onClick={() => startEditLimit(user)}
                          className="rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-3 disabled:opacity-50"
                          title="Changer la limite de pages"
                        >
                          {user.pageLimit ?? 1} page{(user.pageLimit ?? 1) > 1 ? "s" : ""}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[user.status]}`}>
                        {STATUS_LABELS[user.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {user.status !== "ACTIVE" ? (
                          <button
                            type="button"
                            disabled={busy === user.id}
                            onClick={() => runAction(user.id, `/api/admin/users/${user.id}/unban`)}
                            className="rounded-lg bg-success/15 px-2.5 py-1 text-xs font-medium text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                          >
                            Lever la sanction
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy === user.id}
                              onClick={() =>
                                runAction(user.id, `/api/admin/users/${user.id}/suspend`, {
                                  days: 7,
                                  reason: "Suspension depuis le panel admin",
                                })
                              }
                              className="rounded-lg bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/25 disabled:opacity-50"
                            >
                              Suspendre 7 j
                            </button>
                            <button
                              type="button"
                              disabled={busy === user.id}
                              onClick={() =>
                                runAction(user.id, `/api/admin/users/${user.id}/ban`, {
                                  reason: "Bannissement depuis le panel admin",
                                })
                              }
                              className="rounded-lg bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
                            >
                              Bannir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-content-muted">
            <span>
              {data.pagination.total} utilisateur(s) — page {data.pagination.page} sur {data.pagination.totalPages}
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
