"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type LoginResponse =
  | { twoFactorRequired: true; challengeToken: string }
  | { twoFactorRequired: false; user: { username: string } };

type TwoFactorResponse = {
  user: { username: string };
  usedBackupCode: boolean;
  backupCodesLeft: number;
  warning?: string;
};

/** Messages du callback Discord, renvoyés en query param. */
const DISCORD_ERRORS: Record<string, string> = {
  invalid_state:
    "La connexion Discord a échoué pour des raisons de sécurité. Réessayez depuis cette page.",
  exchange_failed: "Discord n'a pas répondu. Réessayez dans un instant.",
  discord_already_linked: "Ce compte Discord est déjà lié à un autre compte Astra.",
  account_banned: "Ce compte a été banni.",
  account_suspended: "Ce compte est suspendu. Réessayez plus tard.",
  username_unavailable:
    "Impossible de créer un compte automatiquement. Inscrivez-vous avec une adresse email.",
  missing_params: "La connexion Discord a été interrompue.",
  unexpected: "Une erreur est survenue pendant la connexion Discord.",
};

/**
 * Valide la destination de redirection post-connexion.
 *
 * Le paramètre `next` vient de l'URL, donc d'une source non fiable. Sans ce
 * filtre, `?next=https://evil.example` produirait une redirection ouverte :
 * un lien d'apparence légitime vers notre domaine qui dépose l'utilisateur
 * fraîchement authentifié sur un site tiers.
 *
 * On n'accepte qu'un chemin absolu de notre site. `//evil.example` est un
 * chemin protocole-relatif que le navigateur traite comme une URL externe :
 * il est explicitement écarté.
 */
function safeNextPath(next: string | null): string {
  if (!next) return "/panel";
  if (!next.startsWith("/") || next.startsWith("//")) return "/panel";
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const discordError = searchParams.get("discord_error");

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});

    const result = await api.post<LoginResponse>("/api/auth/login", {
      identifier,
      password,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }

    if (result.data.twoFactorRequired) {
      setChallengeToken(result.data.challengeToken);
      return;
    }

    // refresh() avant push() : le layout du panel lit la session côté
    // serveur. Sans invalidation du cache, il rendrait l'état déconnecté.
    router.refresh();
    router.push(safeNextPath(searchParams.get("next")));
  }

  async function handleTwoFactor(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await api.post<TwoFactorResponse>("/api/auth/login/2fa", {
      challengeToken,
      code,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);

      // Le jeton de défi a expiré : on renvoie au formulaire de départ
      // plutôt que de laisser l'utilisateur saisir des codes dans le vide.
      if (result.code === "UNAUTHENTICATED" && result.message.includes("expiré")) {
        setChallengeToken(null);
        setPassword("");
      }
      return;
    }

    router.refresh();
    router.push(safeNextPath(searchParams.get("next")));
  }

  if (challengeToken) {
    return (
      <div className="flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-xl font-semibold">Double authentification</h1>
          <p className="mt-2 text-sm text-content-secondary">
            Saisissez le code affiché par votre application, ou l&apos;un de vos codes de
            secours.
          </p>
        </header>

        {error && <Alert tone="danger">{error}</Alert>}

        <form onSubmit={handleTwoFactor} className="flex flex-col gap-4">
          <Input
            label="Code de vérification"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            // inputMode numeric ouvre le pavé numérique sur mobile, mais on
            // garde type="text" : les codes de secours sont alphanumériques.
            inputMode="numeric"
            autoFocus
            required
          />

          <Button type="submit" loading={loading} fullWidth size="lg">
            Vérifier
          </Button>

          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setCode("");
              setError(null);
            }}
            className="text-xs text-content-muted transition-colors hover:text-content-secondary"
          >
            Revenir à la connexion
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">Content de vous revoir</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Connectez-vous pour retrouver votre page.
        </p>
      </header>

      {discordError && <Alert tone="danger">{DISCORD_ERRORS[discordError] ?? DISCORD_ERRORS.unexpected}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <Input
          label="Pseudo ou email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          errors={fields.identifier}
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          required
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            errors={fields.password}
            autoComplete="current-password"
            required
          />
          <Link
            href="/forgot-password"
            className="self-end text-xs text-content-muted transition-colors hover:text-content-secondary"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" loading={loading} fullWidth size="lg">
          Se connecter
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="text-xs text-content-muted">ou</span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      {/* Lien et non bouton : le flux OAuth est une navigation, pas un fetch. */}
      <a
        href="/api/auth/discord"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-surface-3"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-[#5865F2]">
          <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.197.373.291a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.893.077.077 0 0 0-.041.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
        Continuer avec Discord
      </a>

      <p className="text-center text-sm text-content-secondary">
        Pas encore de compte ?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
