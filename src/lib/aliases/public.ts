import "server-only";
import { prisma } from "@/lib/db";

/**
 * Résolution publique d'un alias.
 *
 * Un alias est une adresse courte qui redirige vers la page bio cible. On ne
 * renvoie que le slug de destination : c'est la page cible qui décide ensuite
 * de son propre rendu (publiée, suspendue, protégée, introuvable…).
 */
export async function resolveAlias(slug: string): Promise<string | null> {
  const normalized = slug.toLowerCase();

  const alias = await prisma.alias.findUnique({
    where: { slug: normalized },
    select: { biolink: { select: { slug: true } } },
  });

  return alias?.biolink.slug ?? null;
}
