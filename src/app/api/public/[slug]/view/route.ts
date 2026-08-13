import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { recordView } from "@/lib/biolinks/public";

const bodySchema = z.object({
  referrer: z.string().max(255).optional(),
  // Identifiant aléatoire du navigateur (localStorage), généré par
  // ViewTracker. Hashé avant stockage : la base ne contient jamais
  // d'identifiant de navigateur en clair.
  visitorId: z.string().min(8).max(64).optional(),
});

/** Fenêtre pendant laquelle un navigateur déjà vu reste « non unique ». */
const UNIQUE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/public/:slug/view
 *
 * Enregistre une vue. Une vue unique = un navigateur pas encore vu sur cette
 * page dans les 24 dernières heures. Le navigateur envoie un identifiant
 * aléatoire persistant (localStorage) ; la table `view_fingerprints` porte le
 * dédoublonnage, sans cookie tiers ni stockage d'IP — ça fonctionne même sans
 * Redis.
 */
export const POST = withErrorHandling(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    await enforce("publicPage", `view:${clientIp(request)}`);

    const biolink = await prisma.biolink.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, isPublished: true },
    });

    if (!biolink || !biolink.isPublished) {
      // On répond 200 sans rien enregistrer : un compteur de vues n'a pas à
      // révéler qu'une page existe ou non.
      return ok({ counted: false });
    }

    const raw = await request.text();
    const parsed = bodySchema.safeParse(raw ? JSON.parse(raw) : {});
    const data = parsed.success ? parsed.data : {};
    const referrer = data.referrer;

    const userAgent = request.headers.get("user-agent") ?? "";
    const device = /mobile|android|iphone/i.test(userAgent) ? "mobile" : "desktop";

    // Dédoublonnage par navigateur : une empreinte déjà vue dans les 24 h ne
    // compte pas comme unique. Deux requêtes simultanées du même navigateur
    // sont sérialisées par la contrainte UNIQUE (biolink_id, fingerprint).
    let unique = false;
    if (data.visitorId) {
      const fingerprint = createHash("sha256")
        .update(`view:${data.visitorId}`)
        .digest("base64url")
        .slice(0, 32);

      const existing = await prisma.viewFingerprint.findUnique({
        where: { biolinkId_fingerprint: { biolinkId: biolink.id, fingerprint } },
      });

      if (!existing) {
        await prisma.viewFingerprint.create({
          data: { biolinkId: biolink.id, fingerprint },
        });
        unique = true;
      } else {
        const now = new Date();
        const fresh = now.getTime() - existing.firstSeenAt.getTime() < UNIQUE_WINDOW_MS;
        if (!fresh) {
          // La fenêtre de 24 h est écoulée : le navigateur redevient unique.
          await prisma.viewFingerprint.update({
            where: { id: existing.id },
            data: { firstSeenAt: now, lastSeenAt: now },
          });
          unique = true;
        } else {
          await prisma.viewFingerprint.update({
            where: { id: existing.id },
            data: { lastSeenAt: now },
          });
        }
      }
    }

    const counts = await recordView(biolink.id, { unique, referrer, device });

    // Les compteurs post-incrément partent au navigateur : ViewTracker les
    // redistribue au compteur de visites pour une mise à jour en direct —
    // sans ça, un visiteur verrait toujours le chiffre d'avant sa visite
    // (0 sur une page neuve) jusqu'au prochain rendu ou cache serveur.
    return ok({ counted: true, ...counts });
  }
);
