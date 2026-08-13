import { prisma } from "@/lib/db";
import { ApiError, ok, withErrorHandling } from "@/lib/api";
import { requireUser } from "@/lib/auth/context";
import { destroySession } from "@/lib/auth/session";

/**
 * DELETE /api/auth/sessions/:id
 * Déconnexion à distance d'un appareil.
 */
export const DELETE = withErrorHandling(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;

    const session = await prisma.session.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    // NOT_FOUND et non FORBIDDEN quand la session appartient à quelqu'un
    // d'autre : distinguer les deux permettrait de tester l'existence des
    // sessions des autres.
    if (!session || session.userId !== user.id) {
      throw new ApiError("NOT_FOUND", "Cette session est introuvable.");
    }

    // Se déconnecter soi-même par cet endpoint doit aussi effacer les
    // cookies, sinon le client garde un refresh token qui ne pointe plus
    // sur rien et reste bloqué en « connecté » jusqu'à sa prochaine requête.
    if (session.id === user.sessionId) {
      await destroySession(session.id);
      return ok({ message: "Vous avez été déconnecté de cet appareil.", wasCurrent: true });
    }

    await prisma.session.delete({ where: { id: session.id } });

    return ok({ message: "Appareil déconnecté.", wasCurrent: false });
  }
);
