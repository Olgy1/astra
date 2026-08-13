import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailView } from "./verify-view";

export const metadata: Metadata = {
  title: "Vérification de l'adresse email",
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="h-72" />}>
      <VerifyEmailView />
    </Suspense>
  );
}
