import { ApiError, clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { refreshSession } from "@/lib/auth/session";

/**
 * POST /api/auth/refresh
 *
 * Échange le refresh token contre un nouvel access token, et fait tourner le
 * refresh token au passage.
 */
export const POST = withErrorHandling(async (request: Request) => {
  await enforce("refresh", clientIp(request));

  const result = await refreshSession();

  if (!result.ok) {
    const message =
      result.reason === "USER_BLOCKED"
        ? "Votre compte n'est plus accessible."
        : "Votre session a expiré. Reconnectez-vous.";

    throw new ApiError("UNAUTHENTICATED", message);
  }

  return ok({ user: result.user });
});
