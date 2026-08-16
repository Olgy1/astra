import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, ok, withErrorHandling } from "@/lib/api";
import { enforce } from "@/lib/rate-limit";
import { recordView } from "@/lib/biolinks/public";

const bodySchema = z.object({
  referrer: z.string().max(255).optional(),
});

/** Fenêtre pendant laquelle une adresse IP déjà vue reste « non unique ». */
const UNIQUE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/public/:slug/view
 *
 * Enregistre une vue. Une vue unique = une adresse IP pas encore vue sur cette
 * page dans les 24 dernières heures. L'IP n'est jamais stockée en clair : on
 * hache (SHA-256) et c'est ce hachage que porte la table `view_fingerprints`
 * pour le dédoublonnage, sans cookie tiers.
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

    // Dédoublonnage par adresse IP : une IP déjà vue dans les 24 h ne compte
    // pas comme unique. On stocke un hash SHA-256, jamais l'IP en clair. La
    // contrainte UNIQUE (biolink_id, fingerprint) ferme la course entre deux
    // requêtes simultanées de la même IP : on rattrape la violation au lieu
    // d'échouer.
    const fingerprint = createHash("sha256")
      .update(`ip:${clientIp(request)}`)
      .digest("base64url")
      .slice(0, 32);

    let unique = false;
    const existing = await prisma.viewFingerprint.findUnique({
      where: { biolinkId_fingerprint: { biolinkId: biolink.id, fingerprint } },
    });

    if (!existing) {
      try {
        await prisma.viewFingerprint.create({
          data: { biolinkId: biolink.id, fingerprint },
        });
        unique = true;
      } catch (error) {
        // Course perdue : une requête concurrente a inséré le même hash entre
        // notre findUnique et ce create. La vue existe déjà → non unique.
        if (typeof error === "object" && error !== null && JSON.stringify(error).includes("P2002")) {
          unique = false;
        } else {
          throw error;
        }
      }
    } else {
      const now = new Date();
      const fresh = now.getTime() - existing.firstSeenAt.getTime() < UNIQUE_WINDOW_MS;
      if (!fresh) {
        // La fenêtre de 24 h est écoulée : l'IP redevient unique.
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

    const counts = await recordView(biolink.id, { unique, referrer, device });

    // Les compteurs post-incrément partent au navigateur : ViewTracker les
    // redistribue au compteur de visites pour une mise à jour en direct —
    // sans ça, un visiteur verrait toujours le chiffre d'avant sa visite
    // (0 sur une page neuve) jusqu'au prochain rendu ou cache serveur.
    return ok({ counted: true, ...counts });
  }
);
