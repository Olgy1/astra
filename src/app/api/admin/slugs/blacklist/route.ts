import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, ok, parseBody, withErrorHandling } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/context";
import { writeAdminLog } from "@/lib/admin/log";

/** Normalise un mot de blacklist : minuscules, sans espaces superflus. */
function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Extrait les mots depuis une entrée : soit un mot seul, soit une liste
 * « plain text » avec un mot par ligne (ou séparés par des virgules).
 */
function extractWords(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map(normalizeWord)
    .filter(Boolean);
}

const createSchema = z.object({
  words: z.string().trim().min(1, "Indiquez au moins un mot."),
});

type BlacklistRow = { id: string; word: string; createdAt: string };

function toRow(row: { id: string; word: string; createdAt: Date }): BlacklistRow {
  return { id: row.id, word: row.word, createdAt: row.createdAt.toISOString() };
}

/**
 * GET /api/admin/slugs/blacklist
 * Liste des mots interdits dans les slugs.
 */
export const GET = withErrorHandling(async () => {
  await requireAdmin();

  const words = await prisma.slugBlacklist.findMany({
    select: { id: true, word: true, createdAt: true },
    orderBy: { word: "asc" },
  });

  return ok({ words: words.map(toRow) });
});

/**
 * POST /api/admin/slugs/blacklist
 * Ajoute un ou plusieurs mots interdits. `words` peut être un mot seul ou une
 * liste « plain text » (un mot par ligne). Les doublons sont ignorés.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(request, createSchema);
  const words = extractWords(input.words);

  if (words.length === 0) {
    throw new ApiError("BAD_REQUEST", "Aucun mot valide dans la liste.");
  }

  const existing = await prisma.slugBlacklist.findMany({
    where: { word: { in: words } },
    select: { word: true },
  });
  const existingSet = new Set(existing.map((row) => row.word));
  const fresh = words.filter((word) => !existingSet.has(word));

  if (fresh.length > 0) {
    await prisma.slugBlacklist.createMany({
      data: fresh.map((word) => ({ word })),
      skipDuplicates: true,
    });
  }

  await writeAdminLog({
    admin,
    action: "slug.blacklist.add",
    targetType: "slug",
    targetId: fresh.join(",") || words.join(","),
    metadata: { words: fresh.length > 0 ? fresh : words, duplicates: words.length - fresh.length },
    ip: clientIp(request),
  });

  const all = await prisma.slugBlacklist.findMany({
    select: { id: true, word: true, createdAt: true },
    orderBy: { word: "asc" },
  });

  return ok({ words: all.map(toRow), added: fresh, duplicates: words.length - fresh.length }, 201);
});

/**
 * DELETE /api/admin/slugs/blacklist/:word
 * Retire un mot de la blacklist. Géré par la route dynamique.
 */
