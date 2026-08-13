"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PasswordStrength } from "@/components/ui/password-strength";

type RegisterResponse = {
  user: { username: string; email: string };
  message: string;
};

export function RegisterForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});

    const result = await api.post<RegisterResponse>("/api/auth/register", {
      username,
      email,
      password,
      acceptTerms,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }

    // L'inscription ouvre une session : on entre directement dans le panel.
    // L'email n'est pas encore vérifié, le panel affichera la bannière qui le
    // rappelle — mieux vaut ça qu'un cul-de-sac « consultez vos emails » avant
    // même d'avoir vu le produit.
    router.refresh();
    router.push("/panel");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">Créez votre page</h1>
        <p className="mt-2 text-sm text-content-secondary">
          Gratuit, et prêt en deux minutes.
        </p>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Pseudo"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          errors={fields.username}
          hint="Lettres, chiffres et underscores. 3 à 32 caractères."
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          required
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          errors={fields.email}
          autoComplete="email"
          autoCapitalize="none"
          required
        />

        <div className="flex flex-col gap-2">
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            errors={fields.password}
            autoComplete="new-password"
            required
          />
          <PasswordStrength password={password} />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-content-secondary">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
            required
          />
          <span>
            J&apos;accepte les{" "}
            <Link href="/terms" className="text-accent hover:underline">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {fields.acceptTerms && (
          <p role="alert" className="-mt-2 text-xs text-danger">
            {fields.acceptTerms.join(" ")}
          </p>
        )}

        <Button type="submit" loading={loading} fullWidth size="lg">
          Créer mon compte
        </Button>
      </form>

      <p className="text-center text-sm text-content-secondary">
        Déjà inscrit ?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
