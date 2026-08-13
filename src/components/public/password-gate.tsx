"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

/**
 * Écran de saisie du mot de passe d'une page protégée.
 *
 * En cas de succès, le serveur pose un cookie de déverrouillage court, et on
 * recharge : la page rendue côté serveur détecte alors le cookie et sert le
 * contenu. On ne renvoie jamais le contenu protégé dans la réponse de
 * déverrouillage — sinon il suffirait de lire cette réponse pour contourner
 * la protection sans jamais recharger.
 */
export function PasswordGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await api.post<{ unlocked: boolean }>(`/api/public/${slug}/unlock`, {
      password,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setPassword("");
      return;
    }

    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0a0a0f] px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/10">
            <svg viewBox="0 0 24 24" className="size-6 fill-white/80" aria-hidden>
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-semibold">Page protégée</h1>
            <p className="mt-1 text-sm text-white/60">
              Saisissez le mot de passe pour accéder à cette page.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            autoFocus
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition-colors focus:border-white/40"
          />

          {error && (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Vérification…" : "Accéder"}
          </button>
        </form>
      </div>
    </main>
  );
}
