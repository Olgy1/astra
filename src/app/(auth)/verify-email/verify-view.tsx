"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Alert } from "@/components/ui/alert";

type State =
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type VerifyResponse = { alreadyVerified: boolean; message: string };

export function VerifyEmailView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>({ status: "loading" });

  // En mode strict de React, les effets s'exécutent deux fois en
  // développement. Sans ce garde, le token serait consommé au premier appel
  // et le second afficherait « lien déjà utilisé » — un faux négatif qui
  // n'apparaîtrait qu'en local.
  const verified = useRef(false);

  useEffect(() => {
    if (!token) {
      setState({
        status: "error",
        message: "Ce lien de vérification est incomplet.",
      });
      return;
    }

    if (verified.current) return;
    verified.current = true;

    api.post<VerifyResponse>("/api/auth/verify-email", { token }).then((result) => {
      setState(
        result.ok
          ? { status: "success", message: result.data.message }
          : { status: "error", message: result.message }
      );
    });
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">
          {state.status === "loading"
            ? "Vérification en cours…"
            : state.status === "success"
              ? "Adresse confirmée"
              : "Vérification impossible"}
        </h1>
      </header>

      {state.status === "loading" && (
        <div className="flex justify-center py-4">
          <span
            aria-label="Chargement"
            role="status"
            className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
          />
        </div>
      )}

      {state.status === "success" && <Alert tone="success">{state.message}</Alert>}
      {state.status === "error" && <Alert tone="danger">{state.message}</Alert>}

      {state.status !== "loading" && (
        <Link
          href={state.status === "success" ? "/panel" : "/login"}
          className="rounded-xl bg-accent px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {state.status === "success" ? "Aller à mon panel" : "Revenir à la connexion"}
        </Link>
      )}
    </div>
  );
}
