import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolink } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { checkSlugAvailability } from "@/lib/schemas/slug";
import { changeSlugSchema } from "@/lib/schemas/biolink";

/**
 * POST /api/biolinks/:id/slug
 * Change l'adresse publique de la page.
 */
export const POST = withErrorHandling(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;

    await enforce("mutation", `slug:${user.id}`);

    const biolink = await requireOwnedBiolink(user, id);
    const input = await parseBody(request, changeSlugSchema);

    if (input.slug === biolink.slug) {
      return ok({ slug: biolink.slug, changed: false, message: "C'est déjà votre lien actuel." });
    }

    const availability = await checkSlugAvailability(input.slug, {
      isAdmin: user.role === "ADMIN",
      excludeBiolinkId: id,
    });

    if (!availability.available) {
      throw new ApiError("CONFLICT", availability.message, { slug: [availability.message] });
    }

    try {
      const updated = await prisma.biolink.update({
        where: { id },
        data: { slug: input.slug },
        select: { slug: true },
      });

      // Les deux caches : l'ancien slug doit cesser de servir la page, sinon
      // elle reste accessible à son ancienne adresse jusqu'à expiration.
      await invalidatePageCache(biolink.slug);
      await invalidatePageCache(updated.slug);

      return ok({
        slug: updated.slug,
        changed: true,
        previousSlug: biolink.slug,
        message: `Votre page est maintenant sur astraa.is-cool.dev/${updated.slug}. L'ancien lien ne fonctionne plus.`,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiError("CONFLICT", "Ce lien vient d'être pris.", {
          slug: ["Ce lien vient d'être pris."],
        });
      }
      throw error;
    }
  }
);
