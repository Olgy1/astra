import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/context";
import { parseThemeConfig } from "@/lib/schemas/theme";
import { normalizeBadges } from "@/lib/badges";
import { EditorProvider, type EditorBiolink } from "@/lib/editor/store";
import { EditorShell } from "@/components/editor/editor-shell";

export const metadata: Metadata = { title: "Éditeur" };

type Props = { params: Promise<{ id: string }> };

/**
 * Éditeur d'une page.
 *
 * Charge tout côté serveur en une passe, puis passe l'état au provider client.
 * L'éditeur n'a donc aucun écran de chargement : il s'affiche déjà rempli.
 */
export default async function EditorPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) redirect(`/login?next=/panel/edit/${id}`);

  const biolink = await prisma.biolink.findUnique({
    where: { id },
    include: {
      links: { orderBy: { position: "asc" } },
      blocks: { orderBy: { position: "asc" } },
      mediaAssets: { select: { id: true, type: true, url: true, key: true } },
      owner: { select: { username: true, discordId: true, discordAvatar: true, badges: true } },
    },
  });

  // NOT_FOUND indistinct : page absente ou appartenant à un tiers. Un admin
  // peut éditer n'importe quelle page (modération).
  if (!biolink || (user.role !== "ADMIN" && biolink.ownerId !== user.id)) {
    notFound();
  }

  const initial: EditorBiolink = {
    id: biolink.id,
    slug: biolink.slug,
    title: biolink.title,
    description: biolink.description,
    isPublished: biolink.isPublished,
    isPasswordProtected: biolink.isPasswordProtected,
    suspendedUntil: biolink.suspendedUntil?.toISOString() ?? null,
    suspensionReason: biolink.suspensionReason,
    seoTitle: biolink.seoTitle,
    seoDescription: biolink.seoDescription,
    ogImageUrl: biolink.ogImageUrl,
    theme: parseThemeConfig(biolink.themeConfig),
    links: biolink.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      icon: link.icon,
      position: link.position,
      isEnabled: link.isEnabled,
      clicks: link.clicks,
    })),
    blocks: biolink.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      config: block.config,
      position: block.position,
      isEnabled: block.isEnabled,
    })),
    media: biolink.mediaAssets,
    owner: { ...biolink.owner, badges: normalizeBadges(biolink.owner.badges) },
  };

  return (
    <EditorProvider initial={initial}>
      <EditorShell />
    </EditorProvider>
  );
}
