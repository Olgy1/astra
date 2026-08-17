"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useEditor } from "@/lib/editor/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/**
 * Réglages de la page : slug et titre de l'onglet.
 *
 * Le changement de slug passe par son propre endpoint (pas par le PATCH
 * debounce) : c'est une action ponctuelle et conséquente — un slug change
 * l'adresse publique — qui mérite un retour immédiat plutôt qu'une sauvegarde
 * silencieuse en tâche de fond. Les deux réglages restants sont affichés
 * directement ouverts, sans sous-catégorie repliable.
 */
export function SettingsPanel() {
  const router = useRouter();
  const { biolink, patchBiolink } = useEditor();

  const [slug, setSlug] = useState(biolink.slug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);

  async function handleSlugChange(event: React.FormEvent) {
    event.preventDefault();
    if (slug === biolink.slug) return;

    setSlugSaving(true);
    setSlugError(null);

    const result = await api.post<{ slug: string }>(`/api/biolinks/${biolink.id}/slug`, { slug });
    setSlugSaving(false);

    if (!result.ok) {
      setSlugError(result.message);
      return;
    }

    // L'URL de l'éditeur contient le slug : on recharge pour la mettre à jour.
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      <section className="border-b border-border-subtle py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-content-muted">
          Adresse de la page
        </h3>
        <form onSubmit={handleSlugChange} className="flex flex-col gap-2">
          <Input
            label="Lien"
            prefix="astraa.is-cool.dev/"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            errors={slugError ? [slugError] : undefined}
          />
          {slug !== biolink.slug && (
            <Alert tone="warning">
              L&apos;ancien lien astraa.is-cool.dev/{biolink.slug} cessera de fonctionner.
            </Alert>
          )}
          <Button type="submit" size="sm" loading={slugSaving} disabled={slug === biolink.slug}>
            Changer le lien
          </Button>
        </form>
      </section>

      <section className="border-b border-border-subtle py-4 last:border-b-0">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-content-muted">
          Titre
        </h3>
        <Input
          label="Titre (onglet, aperçu)"
          value={biolink.seoTitle ?? ""}
          onChange={(event) => patchBiolink({ seoTitle: event.target.value || null })}
          hint="Vide = le titre de la page."
        />
      </section>
    </div>
  );
}
