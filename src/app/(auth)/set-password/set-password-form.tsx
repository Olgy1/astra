"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PasswordStrength } from "@/components/ui/password-strength";

/**
 * Formulaire de création du premier mot de passe (compte créé via Discord).
 *
 * Appelé après redirection du callback Discord : la session est déjà ouverte,
 * il ne manque que le mot de passe. La validation qui fait foi est côté
 * serveur (`setPasswordSchema`) ; la jauge de force n'est qu'un guide.
 */
export function SetPasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});

    if (password !== confirm) {
      setLoading(false);
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    const result = await api.post<{ message: string }>("/api/auth/password/set", {
      password,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }

    router.push("/panel");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">Créez un mot de passe</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Votre compte a été créé avec Discord. Choisissez un mot de passe pour
          pouvoir vous connecter aussi par email.
        </p>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Input
            label="Mot de passe"
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
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
        />

        <Button type="submit" loading={loading} fullWidth size="lg">
          Définir mon mot de passe
        </Button>
      </form>

      <p className="text-center text-sm text-content-secondary">
        <Link href="/panel" className="text-accent hover:underline">
          Aller à mon panel
        </Link>
      </p>
    </div>
  );
}
