"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await api.post<{ message: string }>("/api/auth/password/forgot", {
      email,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // L'API répond la même chose que l'adresse existe ou non, pour ne pas
    // révéler quels emails ont un compte. L'écran suit la même logique : il
    // ne confirme jamais l'existence du compte.
    setMessage(result.data.message);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-xl font-semibold">Vérifiez vos emails</h1>
        </header>

        <Alert tone="success">{message}</Alert>

        <p className="text-center text-xs text-content-muted">
          Le lien expire dans 30 minutes.
        </p>

        <Link
          href="/login"
          className="text-center text-sm text-accent hover:underline"
        >
          Revenir à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Renseignez votre adresse, nous vous enverrons un lien de réinitialisation.
        </p>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          autoFocus
          required
        />

        <Button type="submit" loading={loading} fullWidth size="lg">
          Envoyer le lien
        </Button>
      </form>

      <Link href="/login" className="text-center text-sm text-content-muted hover:text-content-secondary">
        Revenir à la connexion
      </Link>
    </div>
  );
}
