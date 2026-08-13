import { prisma } from "@/lib/db";
import { ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/context";

/**
 * GET /api/me/export
 *
 * Export RGPD : toutes les données personnelles de l'utilisateur, en JSON.
 *
 * Rate-limité à peu d'appels : l'export lit l'intégralité des données du
 * compte, c'est une requête lourde qu'on ne veut pas voir marteler.
 *
 * On exclut soigneusement les secrets : hash de mot de passe, hash des tokens,
 * secret 2FA. L'export sert à donner à l'utilisateur SES données, pas à lui
 * livrer de quoi attaquer son propre compte si le fichier fuite.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  await enforce("passwordReset", `export:${user.id}`);

  const data = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      emailVerified: true,
      twoFactorEnabled: true,
      discordId: true,
      discordUsername: true,
      createdAt: true,
      lastLogin: true,
      biolinks: {
        select: {
          slug: true,
          title: true,
          description: true,
          themeConfig: true,
          isPublished: true,
          totalViews: true,
          createdAt: true,
          links: { select: { label: true, url: true, position: true, clicks: true } },
          blocks: { select: { type: true, config: true, position: true } },
          analytics: { select: { date: true, views: true, uniqueViews: true, referrers: true, devices: true, countries: true } },
        },
      },
      mediaAssets: { select: { type: true, url: true, mimeType: true, sizeBytes: true, createdAt: true } },
      sessions: { select: { userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true } },
    },
  });

  const response = ok({
    exportedAt: new Date().toISOString(),
    format: "astra-gdpr-export-v1",
    account: data,
  });

  // En-tête de téléchargement : le navigateur propose d'enregistrer le fichier
  // plutôt que de l'afficher.
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="astra-export-${user.username}-${new Date().toISOString().slice(0, 10)}.json"`
  );

  return response;
});
