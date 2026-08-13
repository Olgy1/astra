import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";
import { BADGES, normalizeBadges, type BadgeKey } from "@/lib/badges";

type Context = { params: Promise<{ id: string }> };

const badgeSchema = z.object({
  badge: z.enum(BADGES.map((badge) => badge.key) as [BadgeKey, ...BadgeKey[]]),
});

/**
 * GET /api/admin/users/:id/badges
 * Badges actuels du compte + catalogue disponible. Utile pour remplir
 * l'interface d'attribution.
 */
export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  await requireAdmin();
  const { id } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, badges: true },
  });

  if (!user) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  return ok({
    badges: normalizeBadges(user.badges),
    catalog: BADGES,
  });
});

/**
 * POST /api/admin/users/:id/badges
 * Attribue un badge. Journalisé : l'attribution d'un badge de confiance doit
 * laisser une trace.
 */
export const POST = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, badgeSchema);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, badges: true },
  });

  if (!user) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  const current = normalizeBadges(user.badges);

  if (current.includes(input.badge)) {
    throw new ApiError("CONFLICT", `${user.username} possède déjà ce badge.`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { badges: [...current, input.badge] as unknown as object },
  });

  await writeAdminLog({
    admin,
    action: "user.grant_badge",
    targetType: "user",
    targetId: user.id,
    metadata: { username: user.username, badge: input.badge },
    ip: clientIp(request),
  });

  return ok({ badges: [...current, input.badge] });
});

/**
 * DELETE /api/admin/users/:id/badges
 * Retire un badge. Corps : `{ badge }`.
 */
export const DELETE = withErrorHandling(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const input = await parseBody(request, badgeSchema);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, badges: true },
  });

  if (!user) throw new ApiError("NOT_FOUND", "Cet utilisateur est introuvable.");

  const current = normalizeBadges(user.badges);

  if (!current.includes(input.badge)) {
    throw new ApiError("CONFLICT", `${user.username} n'a pas ce badge.`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { badges: current.filter((badge) => badge !== input.badge) as unknown as object },
  });

  await writeAdminLog({
    admin,
    action: "user.revoke_badge",
    targetType: "user",
    targetId: user.id,
    metadata: { username: user.username, badge: input.badge },
    ip: clientIp(request),
  });

  return ok({ badges: current.filter((badge) => badge !== input.badge) });
});
