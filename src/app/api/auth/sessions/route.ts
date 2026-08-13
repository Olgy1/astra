import { prisma } from "@/lib/db";
import { ok, withErrorHandling } from "@/lib/api";
import { requireUser } from "@/lib/auth/context";
import { revokeAllSessions } from "@/lib/auth/session";

/**
 * GET /api/auth/sessions
 * Liste les appareils connectés.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
    orderBy: { lastUsedAt: "desc" },
  });

  return ok({
    sessions: sessions.map((session) => ({
      ...session,
      // Permet au front de marquer « cet appareil » et de désactiver le
      // bouton de déconnexion correspondant.
      isCurrent: session.id === user.sessionId,
      device: describeUserAgent(session.userAgent),
    })),
  });
});

/**
 * DELETE /api/auth/sessions
 * Déconnecte tous les autres appareils, en gardant celui-ci.
 */
export const DELETE = withErrorHandling(async () => {
  const user = await requireUser();
  const count = await revokeAllSessions(user.id, user.sessionId);

  return ok({
    revoked: count,
    message:
      count === 0
        ? "Aucun autre appareil n'était connecté."
        : `${count} appareil(s) déconnecté(s).`,
  });
});

/**
 * Description lisible d'un User-Agent.
 *
 * Volontairement grossier : on n'a pas besoin de savoir que c'est Chrome
 * 131.0.6778.86, on a besoin que l'utilisateur reconnaisse « Chrome sur
 * Windows » et repère l'intrus. Une vraie bibliothèque de parsing serait
 * plusieurs centaines de kilooctets pour ce seul affichage.
 */
function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Appareil inconnu";

  const ua = userAgent.toLowerCase();

  const os = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
      ? "iPad"
      : ua.includes("android")
        ? "Android"
        : ua.includes("mac os")
          ? "macOS"
          : ua.includes("windows")
            ? "Windows"
            : ua.includes("linux")
              ? "Linux"
              : "Système inconnu";

  // L'ordre compte : Edge et Opera contiennent "chrome" dans leur UA, et
  // Chrome contient "safari". Tester du plus spécifique au plus générique.
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("opr/") || ua.includes("opera")
      ? "Opera"
      : ua.includes("firefox")
        ? "Firefox"
        : ua.includes("chrome")
          ? "Chrome"
          : ua.includes("safari")
            ? "Safari"
            : "Navigateur inconnu";

  return `${browser} sur ${os}`;
}
