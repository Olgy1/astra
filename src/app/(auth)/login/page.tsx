import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    // useSearchParams (lecture de ?discord_error) impose une frontière
    // Suspense, sinon Next.js bascule toute la page en rendu dynamique.
    <Suspense fallback={<div className="h-96" />}>
      <LoginForm />
    </Suspense>
  );
}
