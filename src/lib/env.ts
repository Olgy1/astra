import { z } from "zod";

/**
 * Validation des variables d'environnement au démarrage.
 *
 * Le but est de transformer une erreur de configuration en échec immédiat et
 * lisible, plutôt qu'en `undefined` qui remonte trois couches plus loin sous
 * la forme d'un token signé avec le secret "undefined".
 */

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().url("DATABASE_URL doit être une URL postgresql://"),
  REDIS_URL: z.string().url("REDIS_URL doit être une URL redis://"),

  // 32 caractères minimum : en dessous, la signature HMAC-SHA256 est
  // affaiblie au point d'être brute-forçable hors ligne.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET : 32 caractères minimum"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET : 32 caractères minimum"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Clé AES-256-GCM pour les secrets TOTP. 32 octets exactement une fois
  // décodée : AES-256 n'accepte pas d'autre longueur.
  ENCRYPTION_KEY: z
    .string()
    .refine((value) => {
      try {
        return Buffer.from(value, "base64").length === 32;
      } catch {
        return false;
      }
    }, "ENCRYPTION_KEY doit être 32 octets encodés en base64 (openssl rand -base64 32)"),

  // Choix explicite du stockage des médias. "local" écrit sur le disque du
  // serveur (dev, ou petite instance) ; "s3" utilise un bucket compatible S3.
  // Par défaut "local" : le site doit pouvoir tourner sans infra externe.
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  // Dossier des fichiers en mode local, relatif à la racine du projet.
  LOCAL_STORAGE_DIR: z.string().default(".uploads"),

  // S3 optionnel : requis seulement si STORAGE_DRIVER=s3. Le contrôle de
  // cohérence est fait par `assertStorageConfigured()`.
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_HOST: z.string().optional(),
  // Base URL publique des médias (ex. https://media.astra.is-a.dev). Définie
  // quand un CDN (Cloudflare Pages + cache) sert les fichiers devant le
  // bucket : les nouvelles URLs de médias pointent dessus, et l'ancienne
  // route proxy redirige vers lui. Absente (ou vide) = on continue à servir
  // via le proxy de l'application.
  S3_PUBLIC_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("Astra <noreply@astraa.is-cool.dev>"),

  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  LOGIN_ATTEMPTS_BEFORE_CAPTCHA: z.coerce.number().int().positive().default(5),
  CAPTCHA_SECRET_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_CAPTCHA_SITE_KEY: z.string().optional(),
});

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

function loadServerEnv() {
  // Next.js n'inline que les variables NEXT_PUBLIC_* côté client. Toucher au
  // reste depuis un composant client donnerait un objet vide et une erreur
  // incompréhensible : on préfère échouer explicitement ici.
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv a été importé depuis le navigateur. Utilisez clientEnv, " +
        "ou déplacez ce code dans un composant serveur."
    );
  }

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      "Variables d'environnement serveur invalides ou manquantes :\n" +
        formatIssues(parsed.error) +
        "\n\nComparez votre `.env` avec `.env.example`."
    );
  }

  return parsed.data;
}

function loadClientEnv() {
  // Les clés sont écrites en toutes lettres : le bundler Next.js remplace
  // `process.env.NEXT_PUBLIC_X` littéralement, un accès dynamique par
  // variable ne serait pas substitué.
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Variables d'environnement client invalides ou manquantes :\n" +
        formatIssues(parsed.error)
    );
  }

  return parsed.data;
}

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let serverEnvCache: ServerEnv | null = null;

/** Variables serveur. Ne jamais importer depuis un composant client. */
export function serverEnv(): ServerEnv {
  if (!serverEnvCache) {
    serverEnvCache = loadServerEnv();
  }
  return serverEnvCache;
}

export const clientEnv: ClientEnv = loadClientEnv();

/** True si l'envoi d'emails est configuré ; sinon on logge dans la console. */
export function isMailConfigured(): boolean {
  return Boolean(serverEnv().SMTP_HOST);
}

/** True si Discord OAuth est configuré ; sinon le bouton est masqué. */
export function isDiscordConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

/** True si le captcha est configuré ; sinon il est ignoré (dev uniquement). */
export function isCaptchaConfigured(): boolean {
  return Boolean(serverEnv().CAPTCHA_SECRET_KEY);
}

/** True si les médias sont stockés sur S3 ; sinon sur le disque local. */
export function isS3Storage(): boolean {
  return serverEnv().STORAGE_DRIVER === "s3";
}

/**
 * Vérifie que le stockage choisi est complètement configuré.
 *
 * Appelé au premier upload plutôt qu'au démarrage : une instance en stockage
 * local n'a pas besoin des variables S3, et exiger toutes à la fois
 * empêcherait de démarrer sans elles.
 */
export function assertStorageConfigured(): void {
  const env = serverEnv();
  if (env.STORAGE_DRIVER !== "s3") return;

  const missing = (
    [
      ["S3_ENDPOINT", env.S3_ENDPOINT],
      ["S3_REGION", env.S3_REGION],
      ["S3_BUCKET", env.S3_BUCKET],
      ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
      ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
      ["S3_PUBLIC_HOST", env.S3_PUBLIC_HOST],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=s3 mais ces variables manquent : ${missing.join(", ")}.`
    );
  }
}
