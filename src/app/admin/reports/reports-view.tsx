"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: "PENDING" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; username: string } | null;
  resolvedBy: { id: string; username: string } | null;
  biolink: {
    id: string;
    slug: string;
    title: string | null;
    isPublished: boolean;
    suspendedUntil: string | null;
    suspensionReason: string | null;
    owner: { id: string; username: string; email: string };
    _count: { links: number; blocks: number };
  };
};

type ListResponse = {
  reports: Report[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_LABELS: Record<Report["status"], string> = {
  PENDING: "En attente",
  REVIEWING: "En revue",
  RESOLVED: "Résolu",
  DISMISSED: "Écarté",
};

const STATUS_STYLES: Record<Report["status"], string> = {
  PENDING: "bg-warning/15 text-warning",
  REVIEWING: "bg-accent-muted text-accent",
  RESOLVED: "bg-success/15 text-success",
  DISMISSED: "bg-surface-3 text-content-muted",
};

const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam",
  SCAM: "Arnaque",
  IMPERSONATION: "Usurpation d'identité",
  HARASSMENT: "Harcèlement",
  ILLEGAL: "Contenu illégal",
  PHISHING: "Phishing",
  OTHER: "Autre",
};

export function ReportsView() {
  const [status, setStatus] = useState<Report["status"] | "">("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Suspension temporaire : durée + motif, envoyés par email au propriétaire.
  const [suspendFor, setSuspendFor] = useState<string | null>(null);
  const [suspendDays, setSuspendDays] = useState("7");
  const [suspendReason, setSuspendReason] = useState("");

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status) params.set("status", status);

    api.get<ListResponse>(`/api/admin/reports?${params}`).then((result) => {
      if (result.ok) setData(result.data);
      else setError(result.message);
    });
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (reportId: string, next: "REVIEWING" | "RESOLVED" | "DISMISSED", extra?: { unpublish?: boolean }) => {
    setBusy(reportId);
    setError(null);
    setNotice(null);
    const result = await api.patch<{ message?: string }>(`/api/admin/reports/${reportId}`, {
      status: next,
      note: note.trim() || undefined,
      ...extra,
    });
    setBusy(null);
    setNote("");
    setNoteFor(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Signalement traité.");
    load();
  };

  /** Suspension temporaire de la page : durée + motif, email au propriétaire. */
  const suspend = async (reportId: string) => {
    if (!suspendReason.trim()) {
      setError("Le motif de la suspension est requis.");
      return;
    }
    setBusy(reportId);
    setError(null);
    setNotice(null);
    const result = await api.patch<{ message?: string }>(`/api/admin/reports/${reportId}`, {
      status: "RESOLVED",
      suspend: { days: Number.parseInt(suspendDays, 10), reason: suspendReason.trim() },
    });
    setBusy(null);
    setSuspendFor(null);
    setSuspendReason("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Page suspendue.");
    load();
  };

  /** Lève la suspension d'une page avant son terme (email au propriétaire). */
  const unsuspend = async (biolinkId: string, slug: string) => {
    if (!window.confirm(`Lever la suspension de la page astra.is-a.dev/${slug} ? Le propriétaire sera prévenu par email.`)) return;
    setBusy(`unsuspend:${biolinkId}`);
    setError(null);
    setNotice(null);
    const result = await api.post<{ message?: string }>(`/api/admin/biolinks/${biolinkId}/unsuspend`);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Suspension levée.");
    load();
  };

  /** Supprime le signalement (abusif, doublon, nettoyage). */
  const remove = async (reportId: string, slug: string) => {
    if (!window.confirm(`Supprimer ce signalement de la page astra.is-a.dev/${slug} ?`)) return;
    setBusy(reportId);
    setError(null);
    setNotice(null);
    const result = await api.delete<{ message?: string }>(`/api/admin/reports/${reportId}`);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Signalement supprimé.");
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(["", "PENDING", "REVIEWING", "RESOLVED", "DISMISSED"] as const).map((value) => (
          <button
            key={value || "all"}
            type="button"
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              status === value
                ? "bg-accent text-white"
                : "border border-border-subtle bg-surface-1 text-content-muted hover:text-content-primary"
            }`}
          >
            {value === "" ? "Tous" : STATUS_LABELS[value]}
          </button>
        ))}
      </div>

      {notice && (
        <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</p>
      )}
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      {!data && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-col gap-3">
            {data.reports.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border-strong bg-surface-1 p-10 text-center">
                <p className="text-sm text-content-muted">
                  {status === "PENDING"
                    ? "Aucun signalement en attente."
                    : "Aucun signalement dans cette catégorie."}
                </p>
              </div>
            )}

            {data.reports.map((report) => (
              <div key={report.id} className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[report.status]}`}>
                      {STATUS_LABELS[report.status]}
                    </span>
                    <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-medium text-danger">
                      {REASON_LABELS[report.reason] ?? report.reason}
                    </span>
                  </div>
                  <span className="text-xs text-content-muted">
                    {new Date(report.createdAt).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <Link href={`/${report.biolink.slug}`} target="_blank" className="font-medium hover:text-accent">
                    astra.is-a.dev/{report.biolink.slug}
                  </Link>
                  <span className="text-xs text-content-muted">
                    par <Link href={`/admin/users/${report.biolink.owner.id}`} className="hover:text-accent">{report.biolink.owner.username}</Link>
                    {" "}· {report.biolink._count.links} liens · {report.biolink._count.blocks} blocks
                  </span>
                  <span className="text-xs text-content-muted">
                    {report.biolink.isPublished ? (
                      <span className="text-success">En ligne</span>
                    ) : (
                      "Brouillon"
                    )}
                  </span>
                </div>

                {report.details && (
                  <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm text-content-secondary">
                    « {report.details} »
                  </p>
                )}

                <p className="mt-2 text-xs text-content-muted">
                  Signalé par {report.reporter ? report.reporter.username : "visiteur anonyme"}
                  {report.resolvedBy && report.status !== "PENDING" && (
                    <> · traité par {report.resolvedBy.username}</>
                  )}
                </p>

                {report.biolink.suspendedUntil && new Date(report.biolink.suspendedUntil) > new Date() && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning/10 p-3">
                    <p className="text-xs text-warning">
                      Page suspendue jusqu'au{" "}
                      {new Date(report.biolink.suspendedUntil).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {report.biolink.suspensionReason && (
                        <> — Motif : {report.biolink.suspensionReason}</>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={busy === `unsuspend:${report.biolink.id}`}
                      onClick={() => unsuspend(report.biolink.id, report.biolink.slug)}
                      className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                    >
                      Lever la suspension
                    </button>
                  </div>
                )}

                {report.status === "PENDING" || report.status === "REVIEWING" ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {noteFor === report.id && (
                      <input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Note de résolution (optionnel)…"
                        className="rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => setNoteFor(noteFor === report.id ? null : report.id)}
                        className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
                      >
                        {noteFor === report.id ? "Annuler la note" : "Ajouter une note"}
                      </button>
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => resolve(report.id, "REVIEWING")}
                        className="rounded-lg bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
                      >
                        Mettre en revue
                      </button>
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => resolve(report.id, "RESOLVED")}
                        className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                      >
                        ✓ Résoudre (aucun problème)
                      </button>
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => resolve(report.id, "DISMISSED")}
                        className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
                      >
                        Écarter (signalement abusif)
                      </button>
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => resolve(report.id, "RESOLVED", { unpublish: true })}
                        className="rounded-lg bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
                      >
                        Résoudre : dépublier la page
                      </button>
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => setSuspendFor(suspendFor === report.id ? null : report.id)}
                        className="rounded-lg bg-warning/15 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/25 disabled:opacity-50"
                      >
                        Suspendre la page…
                      </button>
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => remove(report.id, report.biolink.slug)}
                        className="rounded-lg bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
                      >
                        Supprimer le signalement
                      </button>
                    </div>

                    {suspendFor === report.id && (
                      <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <label htmlFor={`suspend-days-${report.id}`} className="text-content-muted">
                            Durée
                          </label>
                          <select
                            id={`suspend-days-${report.id}`}
                            value={suspendDays}
                            onChange={(event) => setSuspendDays(event.target.value)}
                            className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent"
                          >
                            <option value="1">1 jour</option>
                            <option value="3">3 jours</option>
                            <option value="7">7 jours</option>
                            <option value="14">14 jours</option>
                            <option value="30">30 jours</option>
                          </select>
                          <span className="text-content-muted">
                            — le propriétaire ({report.biolink.owner.username}) sera prévenu par email.
                          </span>
                        </div>
                        <textarea
                          value={suspendReason}
                          onChange={(event) => setSuspendReason(event.target.value)}
                          placeholder="Motif de la suspension (envoyé par email et affiché sur la page)…"
                          rows={2}
                          maxLength={500}
                          className="resize-none rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition-colors placeholder:text-content-muted focus:border-accent"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy === report.id}
                            onClick={() => suspend(report.id)}
                            className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                          >
                            Confirmer la suspension
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSuspendFor(null);
                              setSuspendReason("");
                            }}
                            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  report.resolutionNote && (
                    <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-content-secondary">
                      Note : {report.resolutionNote}
                    </p>
                  )
                )}
              </div>
            ))}
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-content-muted">
              <span>
                {data.pagination.total} signalement(s) — page {data.pagination.page} sur {data.pagination.totalPages}
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
          )}
        </>
      )}
    </div>
  );
}
