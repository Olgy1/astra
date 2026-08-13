"use client";

import { useEffect, useRef, useState } from "react";
import type { BlockProps } from "@/components/blocks/types";
import type { VisitCounterBlockConfig } from "@/lib/blocks/definitions/visit-counter";
import type { CountdownBlockConfig } from "@/lib/blocks/definitions/countdown";
import type { DiscordPresenceBlockConfig } from "@/lib/blocks/definitions/discord-presence";
import { resolveFontFamily } from "@/lib/theme/fonts";

export function VisitCounterBlock({ config, page, theme }: BlockProps<VisitCounterBlockConfig>) {
  const blockFont = resolveFontFamily(config.fontFamily, theme.typography.customFontUrl);
  // Vues uniques, pas toutes les visites : recharger la page ne fait pas
  // grimper le compteur. Repli sur le total pour les pages en cache datant
  // d'avant l'introduction du champ.
  const target = page.uniqueViews ?? page.totalViews;
  const [display, setDisplay] = useState(config.animateOnLoad ? 0 : target);
  const rafRef = useRef(0);

  // La visite de ce navigateur vient d'être comptée (POST /view) : la réponse
  // porte les compteurs frais, relayés par ViewTracker via un événement. On
  // les affiche tout de suite — sinon le compteur resterait figé sur la
  // valeur du rendu serveur et un premier visiteur verrait « 0 vues ».
  useEffect(() => {
    function onViewCounted(event: Event) {
      const detail = (event as CustomEvent<{ totalViews: number; uniqueViews: number }>).detail;
      if (typeof detail?.uniqueViews !== "number") return;
      // Coupe l'animation de chargement en cours : elle finirait par écraser
      // la valeur fraîche avec l'ancienne cible.
      cancelAnimationFrame(rafRef.current);
      // Même logique que `target` : les vues uniques, repli sur le total.
      setDisplay(detail.uniqueViews ?? detail.totalViews);
    }
    window.addEventListener("astra:views", onViewCounted);
    return () => window.removeEventListener("astra:views", onViewCounted);
  }, []);

  useEffect(() => {
    if (!config.animateOnLoad) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(target);
      return;
    }

    // Compte animé jusqu'à la valeur réelle, sur ~1 seconde. easeOut : le
    // défilement ralentit à l'approche du total, ce qui paraît naturel.
    const duration = 1000;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, config.animateOnLoad]);

  const formatted = config.compactNotation
    ? new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(display)
    : new Intl.NumberFormat("fr-FR").format(display);

  const content = (
    <>
      <svg viewBox="0 0 24 24" className="size-4 fill-current opacity-70" aria-hidden>
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      </svg>
      <span className="font-semibold tabular-nums">{formatted}</span>
      <span className="text-[var(--page-muted)]">{config.label}</span>
    </>
  );

  if (config.style === "inline") {
    return <span className="inline-flex items-center gap-1.5 text-sm" style={{ fontFamily: blockFont }}>{content}</span>;
  }

  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 text-sm",
        config.style === "card"
          ? "border border-[var(--card-border-color)] bg-[var(--card-bg)] px-4 py-2"
          : "bg-white/5 px-3 py-1.5",
      ].join(" ")}
      style={{ borderRadius: config.style === "card" ? "var(--card-radius)" : "9999px", fontFamily: blockFont }}
    >
      {content}
    </div>
  );
}

function timeParts(targetIso: string): { d: number; h: number; m: number; s: number; expired: boolean } {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };

  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60),
    s: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

export function CountdownBlock({ config, theme }: BlockProps<CountdownBlockConfig>) {
  const [now, setNow] = useState<ReturnType<typeof timeParts> | null>(null);
  const blockFont = resolveFontFamily(config.fontFamily, theme.typography.customFontUrl);

  // Le calcul se fait côté client après le montage : le rendu serveur donne
  // une valeur figée à l'instant du rendu, qui serait fausse dès la seconde
  // suivante. On attend donc l'hydratation pour afficher un décompte vivant.
  useEffect(() => {
    if (!config.targetDate) return;

    setNow(timeParts(config.targetDate));
    const interval = setInterval(() => setNow(timeParts(config.targetDate!)), 1000);
    return () => clearInterval(interval);
  }, [config.targetDate]);

  if (!config.targetDate) return null;
  if (!now) {
    // Réserve la hauteur pendant l'hydratation pour éviter que la page saute.
    return <div className="h-16" aria-hidden />;
  }

  if (now.expired) {
    return <p className="text-center text-lg font-semibold text-[var(--page-accent)]">{config.expiredText}</p>;
  }

  const units = [
    config.showDays && { value: now.d, label: "j" },
    config.showHours && { value: now.h, label: "h" },
    config.showMinutes && { value: now.m, label: "min" },
    config.showSeconds && { value: now.s, label: "s" },
  ].filter((unit): unit is { value: number; label: string } => Boolean(unit));

  return (
    <div className="flex flex-col items-center gap-2" style={{ fontFamily: blockFont }}>
      {config.title && <p className="text-sm text-[var(--page-muted)]">{config.title}</p>}
      <div className={config.style === "inline" ? "flex items-baseline gap-1" : "flex gap-2"}>
        {units.map((unit, index) => (
          <div
            key={unit.label}
            className={
              config.style === "boxes"
                ? "flex min-w-[3.5rem] flex-col items-center border border-[var(--card-border-color)] bg-[var(--card-bg)] px-2 py-2"
                : "flex items-baseline gap-0.5"
            }
            style={config.style === "boxes" ? { borderRadius: "var(--card-radius)" } : undefined}
          >
            <span className="text-xl font-bold tabular-nums">
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="text-xs text-[var(--page-muted)]">{unit.label}</span>
            {config.style === "inline" && index < units.length - 1 && <span className="mx-0.5">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Présence Discord
// ---------------------------------------------------------------------------

type PresenceData = {
  status: "online" | "idle" | "dnd" | "offline";
  activity: { name: string; details?: string; state?: string; largeImage?: string } | null;
  spotify: { song: string; artist: string; albumArt?: string } | null;
};

const STATUS_META: Record<PresenceData["status"], { color: string; label: string }> = {
  online: { color: "#23a55a", label: "En ligne" },
  idle: { color: "#f0b232", label: "Absent" },
  dnd: { color: "#f23f43", label: "Ne pas déranger" },
  offline: { color: "#80848e", label: "Hors ligne" },
};

/**
 * Présence Discord en temps réel.
 *
 * Les données viennent de notre API, qui les relaie depuis Discord (câblé à
 * l'étape 7). Ce composant gère les trois états qui comptent : chargement,
 * indisponible, et présence affichée. Un widget externe qui échoue ne doit
 * jamais casser la page — au pire il ne s'affiche pas.
 */
export function DiscordPresenceBlock({ config, page, theme }: BlockProps<DiscordPresenceBlockConfig>) {
  const blockFont = resolveFontFamily(config.fontFamily, theme.typography.customFontUrl);
  const [presence, setPresence] = useState<PresenceData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!page.owner.discordId) {
      setState("unavailable");
      return;
    }

    let active = true;

    async function load() {
      try {
        const response = await fetch(`/api/public/${page.slug}/presence`);
        if (!response.ok) throw new Error("indisponible");
        const json = await response.json();
        if (!active) return;
        setPresence(json.data ?? null);
        setState("ready");
      } catch {
        if (active) setState("unavailable");
      }
    }

    load();
    // Rafraîchi toutes les 30 s : la présence change, mais interroger plus
    // souvent surchargerait l'API pour un gain imperceptible.
    const interval = setInterval(load, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [page.owner.discordId, page.slug]);

  if (state === "unavailable") return null;

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 border border-[var(--card-border-color)] bg-[var(--card-bg)] p-3" style={{ borderRadius: "var(--card-radius)" }}>
        <div className="size-10 animate-pulse rounded-full bg-white/10" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-white/5" />
        </div>
      </div>
    );
  }

  if (!presence) return null;

  const status = STATUS_META[presence.status];

  return (
    <div
      className="flex items-center gap-3 border border-[var(--card-border-color)] bg-[var(--card-bg)] p-3"
      style={{ borderRadius: "var(--card-radius)" }}
    >
      <div className="relative shrink-0">
        {page.owner.discordAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.owner.discordAvatar} alt="" className="size-10 rounded-full" />
        ) : (
          <div className="size-10 rounded-full bg-[#5865F2]" />
        )}
        <span
          className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-[var(--card-bg)]"
          style={{ backgroundColor: status.color }}
          aria-label={status.label}
        />
      </div>

      <div className="min-w-0 flex-1 text-left" style={{ fontFamily: blockFont }}>
        {config.showSpotify && presence.spotify ? (
          <>
            <p className="truncate text-sm font-medium">
              <svg viewBox="0 0 24 24" className="mr-1 inline size-3.5 -translate-y-px fill-current" aria-hidden>
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              {presence.spotify.song}
            </p>
            <p className="truncate text-xs text-[var(--page-muted)]">{presence.spotify.artist}</p>
          </>
        ) : config.showActivity && presence.activity ? (
          <>
            <p className="truncate text-sm font-medium">{presence.activity.name}</p>
            {presence.activity.details && (
              <p className="truncate text-xs text-[var(--page-muted)]">{presence.activity.details}</p>
            )}
          </>
        ) : (
          <>
            <p className="truncate text-sm font-medium">{page.owner.username}</p>
            <p className="truncate text-xs text-[var(--page-muted)]">{status.label}</p>
          </>
        )}
      </div>
    </div>
  );
}
