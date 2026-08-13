import { prisma } from "@/lib/db";
import { ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedBiolink } from "@/lib/biolinks/access";
import { invalidatePageCache } from "@/lib/redis";
import { hashPassword } from "@/lib/auth/password";
import { setPagePasswordSchema } from "@/lib/schemas/biolink";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/biolinks/:id/password
 * Active ou change le mot de passe de la page publique.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await enforce("mutation", `pagepwd:${user.id}`);

  const biolink = await requireOwnedBiolink(user, id);
  const input = await parseBody(request, setPagePasswordSchema);

  // Argon2 comme pour un mot de passe de compte, alors que celui-ci protège
  // bien moins. Le surcoût est nul en pratique — on ne hache qu'à
  // l'enregistrement — et il n'existe aucune bonne raison de tenir deux
  // qualités de hachage dans la même base.
  await prisma.biolink.update({
    where: { id },
    data: {
      isPasswordProtected: true,
      passwordHash: await hashPassword(input.password),
    },
  });

  await invalidatePageCache(biolink.slug);

  return ok({
    message:
      "Votre page est protégée. Les visiteurs devront saisir ce mot de passe pour la voir.",
  });
});

/**
 * DELETE /api/biolinks/:id/password
 * Retire la protection.
 */
export const DELETE = withErrorHandling(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const biolink = await requireOwnedBiolink(user, id);

  // Les deux champs ensemble : la contrainte
  // `biolinks_password_coherence_check` interdit `is_password_protected` sans
  // hash, et un hash orphelin resterait en base sans usage.
  await prisma.biolink.update({
    where: { id },
    data: { isPasswordProtected: false, passwordHash: null },
  });

  await invalidatePageCache(biolink.slug);

  return ok({ message: "Votre page est de nouveau accessible à tous." });
});
