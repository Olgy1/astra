import Redis from "ioredis";
import { serverEnv } from "@/lib/env";

/**
 * Client Redis partagé. Même problème de hot reload que Prisma : sans cache
 * global, chaque rechargement laisserait une connexion TCP orpheline.
 */

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createClient(): Redis {
  const client = new Redis(serverEnv().REDIS_URL, {
    // Redis sert au cache et au rate limiting, pas au stockage de vérité.
    // Une commande qui échoue doit remonter vite plutôt que bloquer la
    // requête HTTP : les appelants savent dégrader (voir rate-limit.ts).
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      if (times > 5) return null; // abandonne, l'app tourne sans cache
      return Math.min(times * 200, 2000);
    },
  });

  client.on("error", (error) => {
    console.error("[redis] erreur de connexion :", error.message);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/** Préfixes de clés, centralisés pour éviter les collisions entre modules. */
export const redisKeys = {
  rateLimit: (scope: string, identifier: string) => `rl:${scope}:${identifier}`,
  loginFailures: (identifier: string) => `login:fail:${identifier}`,
  biolinkPage: (slug: string) => `page:${slug}`,
  uniqueView: (biolinkId: string, visitorHash: string) =>
    `view:${biolinkId}:${visitorHash}`,
  pageUnlock: (biolinkId: string, visitorHash: string) =>
    `unlock:${biolinkId}:${visitorHash}`,
} as const;

/**
 * Invalide le cache d'une page publique. À appeler après toute modification
 * du biolink, de ses liens ou de ses blocks.
 */
export async function invalidatePageCache(slug: string): Promise<void> {
  try {
    await redis.del(redisKeys.biolinkPage(slug));
  } catch (error) {
    // Un cache qu'on n'a pas pu invalider expirera de lui-même (TTL court).
    // Ça ne justifie pas de faire échouer la sauvegarde de l'utilisateur.
    console.error("[redis] invalidation du cache échouée :", error);
  }
}

/**
 * Invalide le cache de toutes les pages publiques (pattern `page:*`).
 * À appeler après une opération globale comme la réinitialisation des
 * statistiques, qui touche chaque page affichant son compteur de vues.
 */
export async function invalidateAllPageCache(): Promise<void> {
  try {
    // scan plutôt que keys : évite de bloquer Redis sur un gros dataset.
    const stream = redis.scanStream({ match: `${redisKeys.biolinkPage("")}*`, count: 100 });
    const keys: string[] = [];
    for await (const batch of stream) {
      keys.push(...batch);
    }
    if (keys.length > 0) await redis.del(...keys);
  } catch (error) {
    // Un cache non invalidé expirera de lui-même (TTL court).
    console.error("[redis] invalidation globale du cache échouée :", error);
  }
}
