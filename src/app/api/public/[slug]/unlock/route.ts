import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";
import { issueUnlockToken, unlockCookieName, UNLOCK_TTL_SECONDS } from "@/lib/biolinks/unlock";
import { unlockPageSchema } from "@/lib/schemas/biolink";

/**
 * POST /api/public/:slug/unlock
 *
 * Vérifie le mot de passe d'une page protégée. En cas de succès, pose un
 * cookie de déverrouillage — et ne renvoie jamais le contenu protégé, pour
 * que la seule façon d'y accéder reste le rendu serveur qui vérifie le cookie.
 */
export const POST = withErrorHandling(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;

    // Rate limit strict, par IP et par page : c'est un bruteforce de mot de
    // passe de page qu'on freine ici.
    await enforce("login", `unlock:${clientIp(request)}`);
    await enforce("login", `unlock:${slug}`);

    const input = await parseBody(request, unlockPageSchema);

    const biolink = await prisma.biolink.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, passwordHash: true, isPasswordProtected: true, isPublished: true },
    });

    // Même réponse pour « page inexistante » et « mot de passe faux » : ne pas
    // confirmer qu'une page protégée existe à cette adresse.
    if (!biolink || !biolink.isPublished || !biolink.isPasswordProtected || !biolink.passwordHash) {
      throw new ApiError("UNAUTHENTICATED", "Mot de passe incorrect.");
    }

    if (!(await verifyPassword(biolink.passwordHash, input.password))) {
      throw new ApiError("UNAUTHENTICATED", "Mot de passe incorrect.");
    }

    const store = await cookies();
    store.set(unlockCookieName(biolink.id), issueUnlockToken(biolink.id), {
      httpOnly: true,
      secure: serverEnv().NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: UNLOCK_TTL_SECONDS,
    });

    return ok({ unlocked: true });
  }
);
