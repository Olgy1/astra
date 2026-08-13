"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

type UserDetail = {
  id: string;
  username: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  pageLimit: number | null;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  discordId: string | null;
  discordUsername: string | null;
  twoFactorEnabled: boolean;
  statusReason: string | null;
  suspendedUntil: string | null;
  createdAt: string;
  lastLogin: string | null;
  biolinks: {
    id: string;
    slug: string;
    title: string | null;
    isPublished: boolean;
    isPasswordProtected: boolean;
    suspendedUntil: string | null;
    totalViews: number;
    uniqueViews: number;
    createdAt: string;
    _count: { links: number; blocks: number };
  }[];
  sessions: {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
  }[];
  reportsMade: {
    id: string;
    biolink: { id: string; slug: string };
    reason: string;
    status: string;
    createdAt: string;
  }[];
  reportsAgainst: {
    id: string;
    biolink: { id: string; slug: string };
    reason: string;
    status: string;
    createdAt: string;
  }[];
  suspensions: {
    id: string;
    reason: string;
    startedAt: string;
    until: string | null;
    liftedAt: string | null;
    biolink: { id: string; slug: string; suspendedUntil: string | null };
    admin: { id: string; username: string };
  }[];
  badges?: string[];
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: UserDetail["status"]) {
  const styles: Record<UserDetail["status"], string> = {
    ACTIVE: "bg-success/15 text-success",
    SUSPENDED: "bg-warning/15 text-warning",
    BANNED: "bg-danger/15 text-danger",
  };
  const labels: Record<UserDetail["status"], string> = {
    ACTIVE: "Actif",
    SUSPENDED: "Suspendu",
    BANNED: "Banni",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>;
}

export function UserDetailView({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.get<{ user: UserDetail }>(`/api/admin/users/${userId}`).then((result) => {
      if (result.ok) {
        setUser(result.data.user);
        setLimitDraft(String(result.data.user.pageLimit ?? 1));
      } else {
        setError(result.message);
      }
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Limite de pages : brouillon local, enregistré via l'API admin.
  const [limitDraft, setLimitDraft] = useState("1");
  const [limitBusy, setLimitBusy] = useState(false);

  const saveLimit = async () => {
    const value = Number.parseInt(limitDraft, 10);
    if (!Number.isInteger(value) || value < 1) {
      setError("La limite doit être un nombre entier d'au moins 1.");
      return;
    }
    setLimitBusy(true);
    setError(null);
    setNotice(null);
    const result = await api.patch<{ user: { pageLimit: number | null } }>(`/api/admin/users/${userId}/limit`, {
      pageLimit: value,
    });
    setLimitBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(`Limite fixée à ${value} page${value > 1 ? "s" : ""}.`);
    load();
  };

  const resetLimit = async () => {
    setLimitBusy(true);
    setError(null);
    setNotice(null);
    const result = await api.patch<{ user: { pageLimit: number | null } }>(`/api/admin/users/${userId}/limit`, {
      pageLimit: null,
    });
    setLimitBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Limite par défaut rétablie (1 page).");
    load();
  };

  const [badges, setBadges] = useState<string[]>([]);
  const [badgeCatalog, setBadgeCatalog] = useState<{ key: string; label: string; color: string }[]>([]);
  const [badgeError, setBadgeError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ badges: string[]; catalog: { key: string; label: string; color: string }[] }>(
        `/api/admin/users/${userId}/badges`
      )
      .then((result) => {
        if (result.ok) {
          setBadges(result.data.badges);
          setBadgeCatalog(result.data.catalog);
        }
      });
  }, [userId]);

  const toggleBadge = async (badge: string, grant: boolean) => {
    setBadgeError(null);
    const result = grant
      ? await api.post(`/api/admin/users/${userId}/badges`, { badge })
      : await api.delete(`/api/admin/users/${userId}/badges`, { badge });

    if (!result.ok) {
      setBadgeError(result.message);
      return;
    }

    setBadges((current) =>
      grant ? [...current, badge] : current.filter((value) => value !== badge)
    );
    load();
  };

  const runAction = async (path: string, body?: unknown, method: "post" | "patch" | "delete" = "post") => {
    setBusy(path);
    setError(null);
    setNotice(null);
    const result =
      method === "delete"
        ? await api.delete<{ message?: string }>(path)
        : method === "patch"
          ? await api.patch<{ message?: string }>(path, body)
          : await api.post<{ message?: string }>(path, body);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Action effectuée.");
    load();
  };

  const unsuspendBiolink = async (biolinkId: string, slug: string) => {
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

  const deleteBiolink = async (biolinkId: string, slug: string) => {
    if (!window.confirm(`Supprimer définitivement la page astra.is-a.dev/${slug} ?`)) return;
    setBusy(`biolink:${biolinkId}`);
    setError(null);
    setNotice(null);
    const result = await api.delete<{ message?: string }>(`/api/admin/biolinks/${biolinkId}`);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.data.message ?? "Page supprimée.");
    load();
  };

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
        <Link href="/admin/users" className="text-sm text-accent hover:underline">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/users" className="text-sm text-content-muted hover:text-content-primary">
        ← Retour à la liste
      </Link>

      {notice && (
        <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</p>
      )}
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{user.username}</h2>
              {statusBadge(user.status)}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${user.role === "ADMIN" ? "bg-accent-muted text-accent" : "bg-surface-3 text-content-secondary"}`}>
                {user.role === "ADMIN" ? "Admin" : "Membre"}
              </span>
            </div>
            <p className="mt-1 text-sm text-content-muted">{user.email}</p>
            {user.discordUsername && (
              <p className="mt-0.5 text-xs text-content-muted">Discord : {user.discordUsername}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === "role"}
              onClick={() =>
                runAction(
                  `/api/admin/users/${user.id}/role`,
                  { role: user.role === "ADMIN" ? "MEMBER" : "ADMIN" },
                  "patch"
                )
              }
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              {user.role === "ADMIN" ? "Rétrograder en membre" : "Promouvoir admin"}
            </button>
            <button
              type="button"
              disabled={busy === "reset"}
              onClick={() => runAction(`/api/admin/users/${user.id}/reset-password`)}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              Envoyer un reset de mot de passe
            </button>
            <button
              type="button"
              disabled={busy === "sessions"}
              onClick={() => runAction(`/api/admin/users/${user.id}/sessions`, undefined, "delete")}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              Déconnecter tous ses appareils
            </button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-content-muted">Inscrit le</dt>
            <dd className="mt-0.5">{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Dernière connexion</dt>
            <dd className="mt-0.5">{formatDate(user.lastLogin)}</dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Email vérifié</dt>
            <dd className="mt-0.5">
              <span className={user.emailVerified ? "text-success" : "text-warning"}>
                {user.emailVerified ? "Oui" : "Non"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-content-muted">Double authentification</dt>
            <dd className="mt-0.5">{user.twoFactorEnabled ? "Active" : "Inactive"}</dd>
          </div>
          {user.suspendedUntil && (
            <div>
              <dt className="text-xs text-content-muted">Suspension jusqu'au</dt>
              <dd className="mt-0.5 text-warning">{formatDate(user.suspendedUntil)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium">Limite de pages</h4>
              <p className="mt-0.5 text-xs text-content-muted">
                {user.role === "ADMIN"
                  ? `Illimité — le rôle admin autorise autant de pages que nécessaire (${user.biolinks.length} actuellement).`
                  : `${user.biolinks.length} page(s) utilisée(s) sur ${user.pageLimit ?? 1} autorisée(s).`}
              </p>
            </div>
            {user.role !== "ADMIN" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={limitDraft}
                  disabled={limitBusy}
                  onChange={(event) => setLimitDraft(event.target.value)}
                  className="w-20 rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50"
                  aria-label="Limite de pages"
                />
                <button
                  type="button"
                  disabled={limitBusy}
                  onClick={saveLimit}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  disabled={limitBusy}
                  onClick={resetLimit}
                  className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-3 disabled:opacity-50"
                  title="Rétablir la limite par défaut (1 page)"
                >
                  Par défaut
                </button>
              </div>
            )}
          </div>
        </div>

        {user.statusReason && (
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-content-secondary">
            Motif de la sanction : {user.statusReason}
          </p>
        )}

        {user.status !== "ACTIVE" && (
          <div className="mt-4">
            <button
              type="button"
              disabled={busy === "unban"}
              onClick={() => runAction(`/api/admin/users/${user.id}/unban`)}
              className="rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/25 disabled:opacity-50"
            >
              Lever la sanction
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <h3 className="text-sm font-medium">Badges</h3>
        <p className="mt-1 text-xs text-content-muted">
          Attribués par un admin, affichés sur les pages du compte via le block « Badges ».
        </p>
        {badgeError && (
          <p className="mt-2 rounded-lg border border-danger/30 bg-danger/10 p-2 text-xs text-danger">{badgeError}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badgeCatalog.map((badge) => {
            const granted = badges.includes(badge.key);
            return (
              <button
                key={badge.key}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => toggleBadge(badge.key, !granted)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  granted ? "text-white" : "bg-surface-2 text-content-muted hover:bg-surface-3"
                }`}
                style={granted ? { backgroundColor: badge.color } : undefined}
              >
                {granted ? "✓ " : "+ "}
                {badge.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <h3 className="text-sm font-medium">Pages ({user.biolinks.length})</h3>
        {user.biolinks.length === 0 ? (
          <p className="mt-3 text-sm text-content-muted">Aucune page.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {user.biolinks.map((biolink) => (
              <li
                key={biolink.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3"
              >
                <div className="min-w-0">
                  <Link href={`/admin/biolinks?q=${biolink.slug}`} className="text-sm font-medium hover:text-accent">
                    astra.is-a.dev/{biolink.slug}
                  </Link>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {biolink._count.links} liens · {biolink._count.blocks} blocks · {biolink.uniqueViews} vues uniques
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs">
                  {biolink.suspendedUntil && new Date(biolink.suspendedUntil) > new Date() && (
                    <span
                      className="rounded-full bg-warning/15 px-2 py-0.5 text-warning"
                      title={`Suspendue jusqu'au ${new Date(biolink.suspendedUntil).toLocaleDateString("fr-FR")}`}
                    >
                      Suspendue
                    </span>
                  )}
                  {biolink.suspendedUntil && new Date(biolink.suspendedUntil) > new Date() && (
                    <button
                      type="button"
                      disabled={busy === `unsuspend:${biolink.id}`}
                      onClick={() => unsuspendBiolink(biolink.id, biolink.slug)}
                      className="rounded-lg bg-success/15 px-2.5 py-1 font-medium text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                    >
                      Lever la suspension
                    </button>
                  )}
                  {biolink.isPasswordProtected && (
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-content-muted" title="Protégé par mot de passe">
                      <svg viewBox="0 0 24 24" className="size-3 fill-current" aria-hidden>
                        <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
                      </svg>
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 ${biolink.isPublished ? "bg-success/15 text-success" : "bg-surface-3 text-content-muted"}`}>
                    {biolink.isPublished ? "En ligne" : "Brouillon"}
                  </span>
                  <button
                    type="button"
                    disabled={busy === `biolink:${biolink.id}`}
                    onClick={() => deleteBiolink(biolink.id, biolink.slug)}
                    className="rounded-lg bg-danger/15 px-2.5 py-1 font-medium text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">Historique des suspensions</h3>
          <p className="text-xs text-content-muted">
            Qui, quand, combien de temps et pourquoi — une ligne par suspension.
          </p>
        </div>
        {user.suspensions.length === 0 ? (
          <p className="mt-3 text-sm text-content-muted">Aucune suspension enregistrée.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {user.suspensions.map((suspension) => {
              const lifted = Boolean(suspension.liftedAt);
              const active = !lifted && (suspension.until === null || new Date(suspension.until) > new Date());
              const statusStyle = lifted
                ? "bg-success/15 text-success"
                : active
                  ? "bg-warning/15 text-warning"
                  : "bg-surface-3 text-content-muted";
              const statusLabel = lifted ? "Levée" : active ? "Active" : "Expirée";
              return (
                <li key={suspension.id} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      <Link href={`/admin/biolinks?q=${suspension.biolink.slug}`} className="hover:text-accent">
                        astra.is-a.dev/{suspension.biolink.slug}
                      </Link>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>{statusLabel}</span>
                    </p>
                    <p className="text-xs text-content-muted">
                      par <span className="font-medium text-content-secondary">{suspension.admin.username}</span>
                    </p>
                  </div>
                  <p className="mt-1.5 text-xs text-content-secondary">
                    du {formatDate(suspension.startedAt)} →{" "}
                    {suspension.until ? `au ${formatDate(suspension.until)}` : "durée indéterminée"}
                    {suspension.until && (
                      <span className="text-content-muted">
                        {" "}({Math.max(1, Math.round((new Date(suspension.until).getTime() - new Date(suspension.startedAt).getTime()) / 86_400_000))}{" "}
                        jour{suspension.until && Math.round((new Date(suspension.until).getTime() - new Date(suspension.startedAt).getTime()) / 86_400_000) > 1 ? "s" : ""})
                      </span>
                    )}
                    {suspension.liftedAt && (
                      <span className="text-content-muted"> · levée le {formatDate(suspension.liftedAt)}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-content-muted">Motif : {suspension.reason}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <h3 className="text-sm font-medium">Sessions actives ({user.sessions.length})</h3>
          {user.sessions.length === 0 ? (
            <p className="mt-3 text-sm text-content-muted">Aucune session active.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-xs">
              {user.sessions.map((session) => (
                <li key={session.id} className="rounded-xl bg-surface-2 p-3">
                  <p className="truncate font-medium text-content-secondary">
                    {session.userAgent || "Agent inconnu"}
                  </p>
                  <p className="mt-1 text-content-muted">
                    IP {session.ipAddress || "—"} · dernière activité {formatDate(session.lastUsedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <h3 className="text-sm font-medium">Signalements</h3>
          {user.reportsMade.length === 0 && user.reportsAgainst.length === 0 ? (
            <p className="mt-3 text-sm text-content-muted">Aucun signalement.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {user.reportsAgainst.length > 0 && (
                <div>
                  <p className="text-xs text-content-muted">Pages signalées par d'autres</p>
                  <ul className="mt-1.5 flex flex-col gap-1.5 text-xs">
                    {user.reportsAgainst.map((report) => (
                      <li key={report.id} className="rounded-lg bg-danger/10 p-2.5">
                        <span className="font-medium">astra.is-a.dev/{report.biolink.slug}</span>
                        <span className="text-content-muted"> — {report.reason}</span>
                        <span className="ml-1 text-content-muted">({report.status.toLowerCase()})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {user.reportsMade.length > 0 && (
                <div>
                  <p className="text-xs text-content-muted">Signalements émis</p>
                  <ul className="mt-1.5 flex flex-col gap-1.5 text-xs">
                    {user.reportsMade.map((report) => (
                      <li key={report.id} className="rounded-lg bg-surface-2 p-2.5">
                        <span className="font-medium">astra.is-a.dev/{report.biolink.slug}</span>
                        <span className="text-content-muted"> — {report.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
