"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PasswordStrength } from "@/components/ui/password-strength";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-xl font-semibold">Lien invalide</h1>
        </header>

        <Alert tone="danger">
          Ce lien de réinitialisation est incomplet. Demandez-en un nouveau.
        </Alert>

        <Link href="/forgot-password" className="text-center text-sm text-accent hover:underline">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Contrôle purement local : l'API n'a pas besoin de la confirmation, elle
    // n'existe que pour rattraper une faute de frappe.
    if (password !== confirmation) {
      setFields({ confirmation: ["Les deux mots de passe ne correspondent pas."] });
      return;
    }

    setLoading(true);
    setError(null);
    setFields({});

    const result = await api.post<{ message: string }>("/api/auth/password/reset", {
      token,
      password,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-xl font-semibold">Mot de passe modifié</h1>
        </header>

        <Alert tone="success">
          Toutes vos sessions ont été fermées, y compris sur les appareils que vous ne
          reconnaissiez pas.
        </Alert>

        <Link
          href="/login"
          className="rounded-xl bg-accent px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Choisissez un mot de passe que vous n&apos;utilisez nulle part ailleurs.
        </p>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Input
            label="Nouveau mot de passe"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            errors={fields.password}
            autoComplete="new-password"
            autoFocus
            required
          />
          <PasswordStrength password={password} />
        </div>

        <Input
          label="Confirmer le mot de passe"
          type="password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          errors={fields.confirmation}
          autoComplete="new-password"
          required
        />

        <Button type="submit" loading={loading} fullWidth size="lg">
          Changer mon mot de passe
        </Button>
      </form>
    </div>
  );
}
