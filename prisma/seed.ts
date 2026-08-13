import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

/**
 * Seed de développement.
 *
 * Crée le compte admin de bootstrap et remplit `reserved_slugs`. Idempotent :
 * relançable sans dupliquer ni écraser.
 *
 * Ce fichier n'importe pas `@/lib/*` : il tourne via tsx hors du bundle
 * Next.js, où les alias de chemin ne sont pas résolus.
 */

const prisma = new PrismaClient();

// Doit rester aligné avec SYSTEM_SLUGS dans src/lib/schemas/slug.ts.
const SYSTEM_SLUGS = [
  "api", "login", "register", "signup", "signin", "logout", "auth",
  "dashboard", "panel", "admin", "settings", "account", "profile",
  "verify", "reset", "forgot", "callback", "oauth",
  "about", "help", "support", "contact", "docs", "documentation",
  "terms", "privacy", "legal", "cgu", "cgv", "mentions",
  "pricing", "premium", "upgrade", "billing", "checkout",
  "explore", "discover", "search", "trending", "templates",
  "static", "assets", "public", "cdn", "media", "img", "images",
  "_next", "www", "mail", "null", "undefined",
];

/** Slugs courts et recherchés, attribuables par un admin uniquement. */
const PREMIUM_SLUGS = [
  "x", "z", "v", "k", "j", "q",
  "gg", "yo", "ok", "hi", "me", "up",
  "god", "ceo", "vip", "pro", "dev", "art",
  "king", "queen", "star", "luna", "nova", "rich",
];

async function seedReservedSlugs(): Promise<void> {
  const rows = [
    ...SYSTEM_SLUGS.map((slug) => ({
      slug,
      tier: "RESERVED" as const,
      reason: "Réservé au fonctionnement du site.",
    })),
    ...PREMIUM_SLUGS.map((slug) => ({
      slug,
      tier: "PREMIUM" as const,
      reason: "Lien premium, attribuable par un administrateur.",
    })),
  ];

  const result = await prisma.reservedSlug.createMany({
    data: rows,
    skipDuplicates: true, // rend le seed rejouable
  });

  console.log(`  ${result.count} slug(s) réservé(s) ajouté(s), ${rows.length - result.count} déjà présent(s).`);
}

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !username || !password) {
    console.log("  SEED_ADMIN_* absent du .env, création du compte admin ignorée.");
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { usernameLower: username.toLowerCase() }] },
    select: { id: true, email: true },
  });

  if (existing) {
    console.log(`  Compte admin déjà présent (${existing.email}), inchangé.`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      usernameLower: username.toLowerCase(),
      passwordHash: await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
      role: "ADMIN",
      // Le compte de bootstrap n'a pas de boîte mail à relever : on le marque
      // vérifié directement, sinon il ne pourrait pas se connecter.
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, username: true, email: true },
  });

  console.log(`  Compte admin créé : ${user.username} <${user.email}>`);
  console.log("  ⚠  Changez ce mot de passe dès votre première connexion.");
}

async function main(): Promise<void> {
  console.log("Seed en cours…");

  console.log("\n[1/2] Slugs réservés");
  await seedReservedSlugs();

  console.log("\n[2/2] Compte administrateur");
  await seedAdmin();

  console.log("\nSeed terminé.");
}

main()
  .catch((error) => {
    console.error("Le seed a échoué :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
