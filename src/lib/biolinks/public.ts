import "server-only";
import { prisma } from "@/lib/db";
import { redis, redisKeys } from "@/lib/redis";
import { parseThemeConfig } from "@/lib/schemas/theme";
import { normalizeBadges } from "@/lib/badges";
import type { PublicPage } from "@/lib/biolinks/public-types";

// Réexport pour les consommateurs serveur qui importaient déjà ces types
// depuis ce fichier. La définition vit dans public-types.ts (importable côté
// client) ; ce module y ajoute les accès base et Redis, réservés au serveur.
export type { PublicPage, PublicLink, PublicBlock } from "@/lib/biolinks/public-types";
export { mediaUrl } from "@/lib/biolinks/public-types";

/**
 * Lecture des pages publiques.
 *
 * C'est le chemin le plus chaud de la plateforme : une page virale peut
 * encaisser des milliers de vues par minute, toutes identiques. On le cache
 * dans Redis avec un TTL court, et on l'invalide à chaque écriture (voir
 * `invalidatePageCache`).
 */

/**
 * TTL court : 60 secondes.
 *
 * L'invalidation explicite couvre les modifications passant par l'API. Le TTL
 * est le filet pour tout le reste — une écriture directe en base, une
 * invalidation perdue parce que Redis était indisponible. Une minute de
 * page périmée est acceptable ; une page figée pour toujours ne l'est pas.
 */
const CACHE_TTL_SECONDS = 60;

/**
 * Charge une page publique par son slug.
 *
 * Retourne null si la page n'existe pas, n'est pas publiée, ou si son
 * propriétaire est banni. Ces trois cas donnent le même résultat : un 404. Un
 * message distinct pour « existe mais dépubliée » confirmerait que le pseudo
 * est pris et renseignerait sur l'état d'un compte tiers.
 */
export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  const normalized = slug.toLowerCase();
  const cacheKey = redisKeys.biolinkPage(normalized);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as PublicPage;
  } catch {
    // Cache indisponible : on lit la base. Le site reste debout sans Redis.
  }

  const biolink = await prisma.biolink.findUnique({
    where: { slug: normalized },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      themeConfig: true,
      isPasswordProtected: true,
      isPublished: true,
      suspendedUntil: true,
      suspensionReason: true,
      totalViews: true,
      uniqueViews: true,
      seoTitle: true,
      seoDescription: true,
      ogImageUrl: true,
      owner: {
        select: { username: true, status: true, discordId: true, discordAvatar: true, badges: true },
      },
      links: {
        where: { isEnabled: true },
        orderBy: { position: "asc" },
        select: { id: true, label: true, url: true, icon: true, position: true, clicks: true },
      },
      blocks: {
        where: { isEnabled: true },
        orderBy: { position: "asc" },
        select: { id: true, type: true, config: true, position: true },
      },
      // Plus récent d'abord : `mediaUrl` prend le premier média du type. Un
      // avatar recadré doit gagner sur l'image d'origine (les doublons
      // antérieurs à la purge d'upload restent possibles en base).
      mediaAssets: { select: { type: true, url: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!biolink || !biolink.isPublished) return null;
  if (biolink.owner.status === "BANNED") return null;

  const page: PublicPage = {
    id: biolink.id,
    slug: biolink.slug,
    title: biolink.title,
    description: biolink.description,
    theme: parseThemeConfig(biolink.themeConfig),
    isPasswordProtected: biolink.isPasswordProtected,
    suspendedUntil: biolink.suspendedUntil?.toISOString() ?? null,
    suspensionReason: biolink.suspensionReason,
    totalViews: biolink.totalViews,
    uniqueViews: biolink.uniqueViews,
    seoTitle: biolink.seoTitle,
    seoDescription: biolink.seoDescription,
    ogImageUrl: biolink.ogImageUrl,
    owner: {
      username: biolink.owner.username,
      discordId: biolink.owner.discordId,
      discordAvatar: biolink.owner.discordAvatar,
      badges: normalizeBadges(biolink.owner.badges),
    },
    links: biolink.links,
    blocks: biolink.blocks,
    media: biolink.mediaAssets,
  };

  try {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(page));
  } catch {
    // Échec d'écriture du cache : sans conséquence, on relira la base.
  }

  return page;
}

/** Incrémente d'une unité une clé dans un compteur JSON, sans écraser le reste. */
function bumpCounter(
  counter: unknown,
  key: string | undefined,
  by = 1
): Record<string, number> {
  const map = (counter && typeof counter === "object" ? { ...(counter as Record<string, number>) } : {});
  if (key) map[key] = (map[key] ?? 0) + by;
  return map;
}

const startOfUtcDay = (): Date => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
};

/**
 * Enregistre une vue.
 *
 * Deux écritures : le compteur dénormalisé sur `biolinks` (affiché à chaque
 * rendu, on ne veut pas agréger `analytics` pour ça) et la ligne du jour dans
 * `analytics`.
 *
 * La fusion des compteurs JSON (referrers, appareils, pays) se fait en JS
 * dans une transaction interactive, plutôt qu'en SQL brut. Le read-modify-
 * write pourrait perdre un incrément sous forte concurrence, mais pour de
 * l'analytique ce risque est négligeable — et cette version tourne à
 * l'identique sur Postgres et sur n'importe quel moteur, là où le
 * `jsonb_set` manuscrit dépendait de subtilités du dialecte.
 *
 * `unique` distingue un visiteur déjà vu dans les 24 h. Le dédoublonnage est
 * porté par Redis (clé jetable avec TTL), pas par la base.
 */
export async function recordView(
  biolinkId: string,
  options: { unique: boolean; referrer?: string; device?: string; country?: string }
): Promise<{ totalViews: number; uniqueViews: number }> {
  const date = startOfUtcDay();

  return prisma.$transaction(async (tx) => {
    // `select` renvoie les compteurs après incrément : la route /view les
    // remonte au navigateur pour que le compteur affiché se mette à jour en
    // direct, sans attendre le prochain rendu (ou cache) serveur.
    const counts = await tx.biolink.update({
      where: { id: biolinkId },
      data: {
        totalViews: { increment: 1 },
        // Le compteur public n'affiche que les vues uniques : on n'incrémente
        // que pour un navigateur pas encore vu dans la fenêtre.
        ...(options.unique ? { uniqueViews: { increment: 1 } } : {}),
      },
      select: { totalViews: true, uniqueViews: true },
    });

    const existing = await tx.analytics.findUnique({
      where: { biolinkId_date: { biolinkId, date } },
      select: { referrers: true, devices: true, countries: true },
    });

    if (existing) {
      await tx.analytics.update({
        where: { biolinkId_date: { biolinkId, date } },
        data: {
          views: { increment: 1 },
          uniqueViews: { increment: options.unique ? 1 : 0 },
          referrers: bumpCounter(existing.referrers, options.referrer),
          devices: bumpCounter(existing.devices, options.device),
          countries: bumpCounter(existing.countries, options.country),
        },
      });
    } else {
      await tx.analytics.create({
        data: {
          biolinkId,
          date,
          views: 1,
          uniqueViews: options.unique ? 1 : 0,
          referrers: bumpCounter({}, options.referrer),
          devices: bumpCounter({}, options.device),
          countries: bumpCounter({}, options.country),
        },
      });
    }

    return counts;
  });
}

/** Enregistre un clic sur un lien. */
export async function recordClick(biolinkId: string, linkId: string): Promise<void> {
  const date = startOfUtcDay();

  await prisma.$transaction(async (tx) => {
    await tx.link.update({
      where: { id: linkId },
      data: { clicks: { increment: 1 } },
    });

    const existing = await tx.analytics.findUnique({
      where: { biolinkId_date: { biolinkId, date } },
      select: { clicksByLink: true },
    });

    if (existing) {
      await tx.analytics.update({
        where: { biolinkId_date: { biolinkId, date } },
        data: { clicksByLink: bumpCounter(existing.clicksByLink, linkId) },
      });
    } else {
      await tx.analytics.create({
        data: { biolinkId, date, clicksByLink: bumpCounter({}, linkId) },
      });
    }
  });
}
