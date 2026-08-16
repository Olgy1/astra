"use client";

import { useEffect, useState } from "react";
import type { BlockProps } from "@/components/blocks/types";
import type { VideoBlockConfig } from "@/lib/blocks/definitions/video";
import type { SpotifyBlockConfig } from "@/lib/blocks/definitions/spotify";
import type { RedditBlockConfig } from "@/lib/blocks/definitions/reddit";
import type { DiscordServerBlockConfig } from "@/lib/blocks/definitions/discord-server";
import { resolveFontFamily } from "@/lib/theme/fonts";

const ASPECT: Record<VideoBlockConfig["aspectRatio"], string> = {
  "16:9": "56.25%",
  "4:3": "75%",
  "1:1": "100%",
  "9:16": "177.78%",
};

/**
 * Construit l'URL d'iframe à partir d'une plateforme et d'un identifiant.
 *
 * Retourne null si l'identifiant ne correspond pas au format attendu. C'est
 * la garde qui compte : aucune URL fournie par l'utilisateur n'atteint le
 * `src` d'une iframe. On assemble l'URL nous-mêmes à partir d'une base connue
 * et d'un identifiant validé par regex.
 */
function videoEmbedUrl(config: VideoBlockConfig): string | null {
  const id = config.entityId?.trim();
  if (!id) return null;

  switch (config.platform) {
    case "youtube": {
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
      const params = new URLSearchParams({
        rel: "0",
        // En autoplay, la vidéo est verrouillée (voir le composant) : on
        // masque aussi la barre de contrôle, qui ne servirait à rien.
        ...(config.autoplay ? { autoplay: "1", mute: "1", controls: "0" } : {}),
      });
      return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    }
    case "twitch_channel": {
      if (!/^[a-zA-Z0-9_]{2,32}$/.test(id)) return null;
      // parent est exigé par Twitch : il empêche d'embarquer le lecteur sur
      // un domaine non autorisé. On y met l'hôte public de l'app.
      const parent = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").hostname;
      const params = new URLSearchParams({
        channel: id,
        parent,
        ...(config.autoplay
          ? { autoplay: "true", muted: "true", controls: "false" }
          : { autoplay: "false" }),
      });
      return `https://player.twitch.tv/?${params}`;
    }
    case "twitch_video": {
      if (!/^\d{6,12}$/.test(id)) return null;
      const parent = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").hostname;
      return `https://player.twitch.tv/?video=${id}&parent=${parent}&autoplay=false`;
    }
    default:
      return null;
  }
}

export function VideoBlock({ config }: BlockProps<VideoBlockConfig>) {
  const [activated, setActivated] = useState(!config.lazyLoad);
  const url = videoEmbedUrl(config);

  if (!url) return null;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ paddingBottom: ASPECT[config.aspectRatio], borderRadius: "var(--card-radius)" }}
    >
      {activated ? (
        <>
          <iframe
            src={url}
            title="Vidéo intégrée"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            // sandbox : on n'accorde que le strict nécessaire à un lecteur.
            // Pas de same-origin, donc l'iframe ne peut pas lire nos cookies.
            className="absolute inset-0 size-full border-0"
            loading="lazy"
          />
          {config.autoplay && (
            // Verrou anti-pause : le lecteur est une iframe tierce, on ne
            // peut pas l'empêcher de se mettre en pause depuis notre page.
            // Une couche invisible par-dessus intercepte les clics sur les
            // contrôles et empêche l'iframe de recevoir le focus — donc les
            // touches espace/K du lecteur. La vidéo étant en autoplay, elle
            // joue déjà ; le visiteur ne peut simplement plus l'arrêter.
            // Sans autoplay, on laisse le lecteur interactif : sans cette
            // couche, le visiteur ne pourrait même pas lancer la vidéo.
            <div aria-hidden className="absolute inset-0" />
          )}
        </>
      ) : (
        // Vignette cliquable : une iframe YouTube pèse plusieurs centaines de
        // kilooctets et pose des cookies avant même un intérêt manifesté. On
        // ne la charge qu'au clic.
        <button
          type="button"
          onClick={() => setActivated(true)}
          className="absolute inset-0 flex size-full items-center justify-center bg-black/60 transition-colors hover:bg-black/40"
          aria-label="Charger la vidéo"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--page-accent)]">
            <svg viewBox="0 0 24 24" className="ml-1 size-6 fill-white" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

export function SpotifyBlock({ config }: BlockProps<SpotifyBlockConfig>) {
  if (!config.entityId) return null;

  // L'identifiant est déjà validé (22 caractères base62) par le schéma zod du
  // block ; on assemble l'URL d'embed à partir d'une base fixe.
  const height = config.compact ? 80 : config.entityType === "track" ? 152 : 352;
  const src = `https://open.spotify.com/embed/${config.entityType}/${config.entityId}?theme=${config.theme === "dark" ? "0" : "1"}`;

  return (
    <iframe
      src={src}
      title="Lecteur Spotify"
      height={height}
      allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      className="w-full border-0"
      style={{ borderRadius: "12px" }}
    />
  );
}

export function RedditBlock({ config }: BlockProps<RedditBlockConfig>) {
  // Reddit n'a pas d'iframe officielle propre : on affiche une carte-lien
  // vers le contenu plutôt que d'embarquer un script tiers qui piste le
  // visiteur. Sobre, sûr, et suffisant.
  const href =
    config.mode === "post" && config.postId
      ? `https://reddit.com/comments/${config.postId}`
      : config.subreddit
        ? `https://reddit.com/r/${config.subreddit}`
        : null;

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="flex items-center gap-3 p-4 transition-transform hover:scale-[1.01] active:scale-[0.99]"
      style={{
        // Même recette carte que le block Discord : opacité, flou, bordure et
        // lueur. Le lien Reddit doit avoir l'air d'un morceau de la carte.
        borderRadius: "var(--card-radius)",
        backgroundColor: "color-mix(in oklab, var(--card-bg) calc(var(--card-opacity) * 100%), transparent)",
        backdropFilter: "blur(var(--card-blur))",
        border: "var(--card-border-width) solid var(--card-border-color)",
        boxShadow: "var(--card-shadow), var(--card-glow)",
      }}
    >
      <svg viewBox="0 0 24 24" className="size-8 shrink-0 fill-[#FF4500]" aria-hidden>
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-6.995 4.87s-6.994-2.176-6.994-4.87c0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249z" />
      </svg>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {config.mode === "post" ? "Voir le post" : `r/${config.subreddit}`}
        </p>
        <p className="text-xs text-[var(--page-muted)]">Ouvrir sur Reddit</p>
      </div>
    </a>
  );
}

type DiscordInviteInfo = {
  valid: boolean;
  name?: string | null;
  icon?: string | null;
  memberCount?: number | null;
  onlineCount?: number | null;
};

/** Formate un nombre à la française : 1234567 → « 1 234 567 ». */
function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

/** Icône Discord, utilisée quand le serveur n'a pas d'icône ou avant le chargement. */
function DiscordMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "size-6"} fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.197.373.291a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.893.077.077 0 0 0-.041.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function DiscordServerBlock({ config, theme }: BlockProps<DiscordServerBlockConfig>) {
  // Infos du serveur (nom, icône, compteurs) récupérées depuis l'API
  // publique d'invitation Discord, via notre propre route (le navigateur ne
  // peut pas appeler Discord directement). Tant qu'on n'a rien reçu — ou si
  // l'invitation est invalide — on affiche l'état de repli.
  const [info, setInfo] = useState<DiscordInviteInfo | null>(null);
  const code = config.inviteCode;

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    fetch(`/api/public/discord/invite?code=${encodeURIComponent(code)}`)
      .then((response) => response.json().catch(() => null))
      .then((json) => {
        if (cancelled) return;
        const data = json?.data;
        setInfo(data && data.valid ? data : null);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!code) return null;

  const blockFont = resolveFontFamily(config.fontFamily, theme.typography.customFontUrl, theme.typography.customFontName);

  // Le code d'invitation est validé par regex dans le schéma du block ; on
  // reconstruit l'URL, on n'en accepte jamais une entière.
  const href = `https://discord.gg/${code}`;

  const memberCount = config.showMemberCount ? (info?.memberCount ?? null) : null;
  const onlineCount = config.showOnlineCount ? (info?.onlineCount ?? null) : null;

  const subtitle =
    memberCount != null && onlineCount != null
      ? `${formatNumber(onlineCount)} en ligne · ${formatNumber(memberCount)} membres`
      : memberCount != null
        ? `${formatNumber(memberCount)} membres`
        : onlineCount != null
          ? `${formatNumber(onlineCount)} en ligne`
          : `discord.gg/${code}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="flex items-center gap-3 p-4 transition-transform hover:scale-[1.01] active:scale-[0.99]"
      style={{
        // Exactement la même recette que la carte (et que le lecteur de
        // musique) : fond à l'opacité de la carte, flou, bordure, ombre et
        // lueur. Le block doit avoir l'air d'un morceau de la carte.
        borderRadius: "var(--card-radius)",
        backgroundColor:
          "color-mix(in oklab, var(--card-bg) calc(var(--card-opacity) * 100%), transparent)",
        backdropFilter: "blur(var(--card-blur))",
        border: "var(--card-border-width) solid var(--card-border-color)",
        boxShadow: "var(--card-shadow), var(--card-glow)",
      }}
    >
      {config.showIcon &&
        (info?.icon ? (
          // L'icône du serveur, quand l'API l'a fournie.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.icon}
            alt=""
            loading="lazy"
            className="size-11 shrink-0 rounded-xl object-cover"
          />
        ) : (
          // Repli : le logo Discord sur le fond de la carte.
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: "var(--page-accent)" }}
          >
            <DiscordMark className="size-6" />
          </span>
        ))}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ fontFamily: blockFont }}>
          {info?.name ?? "Serveur Discord"}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-[var(--page-muted)]" style={{ fontFamily: blockFont }}>
          {onlineCount != null && (
            <span className="size-1.5 shrink-0 rounded-full bg-[#23a559]" aria-hidden />
          )}
          <span className="truncate">{subtitle}</span>
        </p>
      </div>

      {/* Bouton « Rejoindre » : à la couleur d'accent de la page, avec une
          lueur, comme les boutons des autres cards. Clic = ouverture de
          l'invitation (toute la carte est le lien). */}
      <span
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-transform hover:scale-105"
        style={{
          backgroundColor: "var(--page-accent)",
          boxShadow:
            "0 0 14px color-mix(in oklab, var(--page-accent) 45%, transparent)",
          fontFamily: blockFont,
        }}
      >
        {config.buttonLabel}
      </span>
    </a>
  );
}
