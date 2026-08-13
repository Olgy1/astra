/**
 * Écran « page suspendue ».
 *
 * Affiché à la place du contenu quand la page est sous suspension de
 * modération. Le propriétaire garde accès à son éditeur pour corriger le
 * motif ; il ne peut ni dépublier ni republier tant que la suspension est
 * active — la page reste donc visible dans cet état jusqu'à la date, où elle
 * revient à la normale automatiquement.
 */
export function SuspendedGate({
  slug,
  reason,
  until,
}: {
  slug: string;
  reason: string | null;
  until: string | null;
}) {
  const untilLabel = until
    ? new Date(until).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0a0a0f] px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-500/15 text-red-400">
          {/* Horloge dans un bouclier : la page est suspendue temporairement. */}
          <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden>
            <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm.5 6h-2v7l5.5 3.2 1-1.73-4.5-2.6V7z" />
          </svg>
        </span>

        <h1 className="text-lg font-semibold">Page suspendue</h1>
        <p className="mt-1 font-mono text-xs text-white/50">astra.is-a.dev/{slug}</p>

        {reason && (
          <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm leading-relaxed text-white/70">
            {reason}
          </p>
        )}

        <p className="mt-4 text-sm text-white/60">
          {untilLabel
            ? <>Cette page est temporairement suspendue jusqu'au {untilLabel}.</>
            : "Cette page est temporairement suspendue."}
        </p>

        <p className="mt-3 text-xs leading-relaxed text-white/40">
          Le propriétaire peut modifier sa page depuis son espace pour corriger
          le problème ; elle réapparaîtra automatiquement à la fin de la
          suspension.
        </p>
      </div>
    </main>
  );
}
