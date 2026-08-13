import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, ok, parseBody, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";
import { verifyPassword } from "@/lib/auth/password";
import { createOneTimeToken, TOKEN_TTL } from "@/lib/auth/tokens";
import { destroySession } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/mail";
import { emailSchema } from "@/lib/schemas/auth";
import { usernameSchema } from "@/lib/schemas/slug";
import { deleteStoredObjects } from "@/lib/storage";

const updateSchema = z
  .object({
    email: emailSchema.optional(),
    username: usernameSchema.optional(),
  })
  .refine((data) => data.email !== undefined || data.username !== undefined, "Aucune modification fournie.");

/**
 * PATCH /api/me
 * Change l'email (revérification requise) ou le pseudo.
 */
export const PATCH = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  await enforce("mutation", `me:${user.id}`);

  const input = await parseBody(request, updateSchema);

  const data: Prisma.UserUpdateInput = {};

  if (input.username && input.username.toLowerCase() !== user.username.toLowerCase()) {
    data.username = input.username;
    data.usernameLower = input.username.toLowerCase();
  }

  let emailChanged = false;
  if (input.email && input.email !== user.email) {
    // Changer d'email repasse le compte en non vérifié : sans ça, on
    // pourrait revendiquer une adresse qu'on ne contrôle pas.
    data.email = input.email;
    data.emailVerified = false;
    data.emailVerifiedAt = null;
    emailChanged = true;
  }

  if (Object.keys(data).length === 0) {
    return ok({ message: "Aucune modification." });
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.some((c) => c.includes("username"))) {
        throw new ApiError("CONFLICT", "Ce pseudo est déjà pris.", { username: ["Ce pseudo est déjà pris."] });
      }
      throw new ApiError("CONFLICT", "Cette adresse est déjà utilisée.", { email: ["Cette adresse est déjà utilisée."] });
    }
    throw error;
  }

  // Nouvel email : on renvoie un lien de vérification à la nouvelle adresse.
  if (emailChanged && input.email) {
    const verification = createOneTimeToken(TOKEN_TTL.emailVerification);
    await prisma.verificationToken.create({
      data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash: verification.tokenHash, expiresAt: verification.expiresAt },
    });
    await sendVerificationEmail(user.id, input.email, input.username ?? user.username, verification.token);
  }

  return ok({
    message: emailChanged
      ? "Modifications enregistrées. Confirmez votre nouvelle adresse email."
      : "Modifications enregistrées.",
    emailChanged,
  });
});

const deleteSchema = z.object({
  password: z.string().min(1, "Renseignez votre mot de passe."),
  confirm: z.literal("SUPPRIMER", { errorMap: () => ({ message: "Tapez SUPPRIMER pour confirmer." }) }),
});

/**
 * DELETE /api/me
 * Supprime le compte, toutes ses données, et ses médias sur S3.
 */
export const DELETE = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  await enforce("login", `delete:${user.id}`);

  const input = await parseBody(request, deleteSchema);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  // Mot de passe exigé, sauf compte Discord sans mot de passe (rare). Sans ce
  // contrôle, une session ouverte suffirait à effacer le compte.
  if (record?.passwordHash) {
    if (!(await verifyPassword(record.passwordHash, input.password))) {
      throw new ApiError("UNAUTHENTICATED", "Mot de passe incorrect.", { password: ["Mot de passe incorrect."] });
    }
  }

  // On relève toutes les clés S3 AVANT de supprimer : la cascade en base
  // effacera les MediaAsset, on n'aurait plus de quoi purger le bucket.
  const assets = await prisma.mediaAsset.findMany({
    where: { ownerId: user.id },
    select: { key: true },
  });

  // La cascade (onDelete: Cascade) emporte biolinks, liens, blocks, sessions,
  // tokens, analytics. Une seule requête, atomique.
  await prisma.user.delete({ where: { id: user.id } });

  if (assets.length > 0) {
    try {
      await deleteStoredObjects(assets.map((a) => a.key));
    } catch (error) {
      console.error("[me] purge S3 incomplète à la suppression du compte :", error);
    }
  }

  await destroySession();

  return ok({ message: "Votre compte et toutes vos données ont été supprimés." });
});
