"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await api.post("/api/auth/logout");

    // refresh() invalide le cache des composants serveur : sans lui, revenir
    // en arrière réafficherait le panel rendu avec la session éteinte.
    router.refresh();
    router.push("/login");
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={handleLogout}>
      Se déconnecter
    </Button>
  );
}
