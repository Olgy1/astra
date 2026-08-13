import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { MEMBER_BIOLINK_LIMIT } from "@/lib/biolinks/access";

type Context = { params: Promise<{ id: string }> };

// null = limite par défaut (1 page pour un membre). Un nombre = limite
// personnalisée. Un admin reste illimité quel que soit ce champ.
const limitSchema = z.object({
  pageLimit: z.number().int().min(1).max(1000).nullable(),
});

/**
 * PATCH /api/admin/users/:id/limit
 *
 * Change la limite de pages d'un compte membre. Journalisé, comme toute
 * action d'administration.
 *
 * On refuse de baisser la limite sous le nombre de pages déjà possédées :
 * accepter créerait un état « utilisé > max » que le reste du système
 * suppose impossible (le quota n'est vérifié qu'à la création).
 */
export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, limitSchema);

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true, pageLimit: true },
  });

  if (!target) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  if (target.role !== "ADMIN" && input.pageLimit !== null) {
    const biolinkCount = await prisma.biolink.count({ where: { ownerId: target.id } });

    if (biolinkCount > input.pageLimit) {
      throw new ApiError(
        "CONFLICT",
        `Ce compte possède déjà ${biolinkCount} page${biolinkCount > 1 ? "s" : ""}. Supprimez-en ${biolinkCount - input.pageLimit} avant de fixer une limite à ${input.pageLimit}.`
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { pageLimit: input.pageLimit },
    select: { id: true, username: true, role: true, pageLimit: true },
  });

  // Pas de révocation de session : la limite est lue en base à chaque
  // création (et le trigger la relit aussi), donc la sanction est immédiate.
  await writeAdminLog({
    admin,
    action: "user.page_limit",
    targetType: "user",
    targetId: target.id,
    metadata: {
      username: target.username,
      from: target.pageLimit ?? MEMBER_BIOLINK_LIMIT,
      to: input.pageLimit ?? MEMBER_BIOLINK_LIMIT,
    },
    ip: clientIp(request),
  });

  return ok({ user: updated });
});
