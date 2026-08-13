import { prisma } from "@/lib/db";
import { ApiError, ok, withErrorHandling } from "@/lib/api";
import { requireUser } from "@/lib/auth/context";
import { invalidatePageCache } from "@/lib/redis";
import { deleteStoredObject } from "@/lib/storage";

/**
 * DELETE /api/media/:id
 * Supprime l'asset en base et sur S3.
 */
export const DELETE = withErrorHandling(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;

    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        id: true,
        key: true,
        ownerId: true,
        biolink: { select: { slug: true } },
      },
    });

    if (!asset || (user.role !== "ADMIN" && asset.ownerId !== user.id)) {
      throw new ApiError("NOT_FOUND", "Ce fichier est introuvable.");
    }

    await prisma.mediaAsset.delete({ where: { id } });

    if (asset.biolink) await invalidatePageCache(asset.biolink.slug);

    // S3 après la base, et sans faire échouer la requête : un objet orphelin
    // sur S3 est invisible et rattrapable ; une ligne qui pointe vers un
    // fichier supprimé casse la page.
    try {
      await deleteStoredObject(asset.key);
    } catch (error) {
      console.error("[media] suppression S3 échouée, ligne déjà retirée :", error);
    }

    return ok({
      message: "Fichier supprimé.",
      // Le média peut encore être référencé dans un themeConfig ou une config
      // de block. Le renderer traite les URL mortes, mais l'éditeur doit
      // pouvoir prévenir plutôt que laisser une image cassée en ligne.
      warning:
        "Si ce fichier était utilisé sur votre page, pensez à le remplacer dans l'éditeur.",
    });
  }
);
