import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { requireOwnedAlias } from "@/lib/aliases/access";

type Context = { params: Promise<{ id: string }> };

/**
 * DELETE /api/aliases/:id
 * Supprime un alias. L'adresse redevient libre pour une page ou un autre alias.
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const user = await requireUser();
  await enforce("mutation", clientIp(request));

  const { id } = await context.params;
  const alias = await requireOwnedAlias(user, id);

  await prisma.alias.delete({ where: { id: alias.id } });

  return ok({ message: "Alias supprimé." });
});
