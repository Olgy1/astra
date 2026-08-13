"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/**
 * Suppression d'une page depuis le panel membre.
 *
 * Confirmation native d'abord (irréversible), puis DELETE /api/biolinks/:id,
 * qui purge aussi liens, blocks et médias. En cas de succès, on rafraîchit le
 * panel pour faire disparaître la carte.
 */
export function DeletePageButton({ id, slug }: { id: string; slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Supprimer définitivement la page astra.is-a.dev/${slug} ?\n\nCette action est irréversible : liens, blocks et médias seront effacés.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const result = await api.delete<{ message: string }>(`/api/biolinks/${id}`);

    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={loading}
        onClick={handleDelete}
        className="shrink-0 text-content-muted hover:bg-danger/10 hover:text-danger"
      >
        Supprimer
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
