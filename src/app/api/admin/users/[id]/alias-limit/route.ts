import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { MEMBER_ALIAS_LIMIT } from "@/lib/aliases/access";

type Context = { params: Promise<{ id: string }> };

// null = limite par défaut (2 alias pour un membre). Un nombre >= 0 = limite
// personnalisée. -1 = illimité. Un admin reste illimité quel que soit ce champ.
const limitSchema = z.object({
  aliasLimit: z.number().int().min(-1).max(1000).nullable(),
});

/**
 * PATCH /api/admin/users/:id/alias-limit
 *
 * Change la limite d'alias d'un compte membre. Journalisé, comme toute action
 * d'administration. On refuse de baisser la limite sous le nombre d'alias déjà
 * possédés.
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, limitSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true, aliasLimit: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  if (target.role !== "ADMIN" && input.aliasLimit !== null && input.aliasLimit !== -1) {
    const aliasCount = await prisma.alias.count({ where: { ownerId: target.id } });

    if (aliasCount > input.aliasLimit) {
      throw new ApiError(
        "CONFLICT",
        `Ce compte possède déjà ${aliasCount} alias. Supprimez-en ${aliasCount - input.aliasLimit} avant de fixer une limite à ${input.aliasLimit}.`
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { aliasLimit: input.aliasLimit },
    select: { id: true, username: true, role: true, aliasLimit: true },
  });

  await writeAdminLog({
    admin,
    action: "user.alias_limit",
    targetType: "user",
    targetId: target.id,
    metadata: {
      username: target.username,
      from: target.aliasLimit ?? MEMBER_ALIAS_LIMIT,
      to: input.aliasLimit ?? MEMBER_ALIAS_LIMIT,
    },
    ip: clientIp(request),
  });

  return ok({ user: updated });
});
