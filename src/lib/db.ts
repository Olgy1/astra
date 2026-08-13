import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma partagé.
 *
 * En développement, le hot reload de Next.js réexécute ce module à chaque
 * modification. Sans le cache sur `globalThis`, chaque rechargement ouvrirait
 * un nouveau pool de connexions et Postgres finirait par refuser les
 * connexions ("too many clients already").
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Code d'erreur Postgres remonté par le trigger de quota (voir
 * sql/001_init.sql). Prisma expose le message brut dans `meta.message`.
 */
export function isQuotaViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = JSON.stringify(error);
  return message.includes("MEMBER_BIOLINK_QUOTA_EXCEEDED");
}

export function isRoleDowngradeBlocked(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = JSON.stringify(error);
  return message.includes("ROLE_DOWNGRADE_BLOCKED");
}
