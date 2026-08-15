"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useEditor } from "@/lib/editor/store";
import { ControlGroup, ToggleControl } from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/**
 * Réglages de la page : slug, protection, SEO, contenu sensible.
 *
 * Le changement de slug et le mot de passe passent par leurs propres endpoints
 * (pas par le PATCH debounce) : ce sont des actions ponctuelles et
 * conséquentes — un slug change l'adresse publique — qui méritent un retour
 * immédiat plutôt qu'une sauvegarde silencieuse en tâche de fond.
 */
export function SettingsPanel() {
  const router = useRouter();
  const { biolink, patchBiolink, setMedia } = useEditor();

  const [slug, setSlug] = useState(biolink.slug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);

  const [pagePassword, setPagePassword] = useState("");
  // État local : la protection a ses propres endpoints (qui persistent), et
  // n'est pas un champ du PATCH debounce. Muter l'objet du store directement
  // ne déclencherait aucun rendu — d'où ce miroir local.
  const [protectedPage, setProtectedPage] = useState(biolink.isPasswordProtected);

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

  async function handleSetPassword() {
    if (pagePassword.length < 4) return;
    const result = await api.post(`/api/biolinks/${biolink.id}/password`, { password: pagePassword });
    if (result.ok) {
      setPagePassword("");
      setProtectedPage(true);
    }
  }

  async function handleRemovePassword() {
    const result = await api.delete(`/api/biolinks/${biolink.id}/password`);
    if (result.ok) setProtectedPage(false);
  }

  return (
    <div className="flex flex-col">
      <ControlGroup title="Adresse de la page">
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
      </ControlGroup>

      <ControlGroup title="SEO et partage">
        <Input
          label="Titre (onglet, aperçu)"
          value={biolink.seoTitle ?? ""}
          onChange={(event) => patchBiolink({ seoTitle: event.target.value || null })}
          hint="Vide = le titre de la page."
        />
        <Input
          label="Description"
          value={biolink.seoDescription ?? ""}
          onChange={(event) => patchBiolink({ seoDescription: event.target.value || null })}
        />
        <Input
          label="Image de partage (Open Graph)"
          value={biolink.ogImageUrl ?? ""}
          onChange={(event) => patchBiolink({ ogImageUrl: event.target.value || null })}
          placeholder="https://"
        />
      </ControlGroup>

      <ControlGroup title="Protection par mot de passe">
        {protectedPage ? (
          <div className="flex flex-col gap-2">
            <Alert tone="info">Cette page demande un mot de passe aux visiteurs.</Alert>
            <Button variant="secondary" size="sm" onClick={handleRemovePassword}>
              Retirer la protection
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              label="Mot de passe"
              type="password"
              value={pagePassword}
              onChange={(event) => setPagePassword(event.target.value)}
              hint="4 caractères minimum."
            />
            <Button variant="secondary" size="sm" onClick={handleSetPassword} disabled={pagePassword.length < 4}>
              Protéger la page
            </Button>
          </div>
        )}
      </ControlGroup>

    </div>
  );
}
