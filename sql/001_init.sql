-- ---------------------------------------------------------------------------
-- Astra Biolink — création du schéma PostgreSQL
--
-- Équivalent SQL de prisma/schema.prisma. Utile pour auditer le schéma,
-- provisionner une base sans la CLI Prisma, ou relire les contraintes.
-- En développement, `npm run db:migrate` fait le même travail via Prisma.
--
-- Requiert PostgreSQL 13+ : gen_random_uuid() fait partie du cœur depuis
-- cette version, aucune extension à installer (pgcrypto n'est plus requis,
-- ce qui évite un CREATE EXTENSION refusé chez un hébergeur managé).
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------

CREATE TYPE "Role"         AS ENUM ('MEMBER', 'ADMIN');
CREATE TYPE "UserStatus"   AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE "TokenType"    AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
CREATE TYPE "MediaType"    AS ENUM ('AVATAR', 'BANNER', 'AUDIO', 'CURSOR', 'BACKGROUND', 'FONT');
CREATE TYPE "SlugTier"     AS ENUM ('RESERVED', 'PREMIUM');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE "users" (
    "id"                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Pseudo tel que saisi, casse préservée : c'est l'affichage.
    "username"           VARCHAR(32)  NOT NULL,
    -- Même pseudo en minuscules : connexion et unicité insensibles à la
    -- casse. Colonne dédiée et non index fonctionnel sur lower(username),
    -- pour que Prisma puisse l'interroger par index.
    "username_lower"     VARCHAR(32)  NOT NULL,
    "email"              VARCHAR(255) NOT NULL,
    -- NULL pour un compte créé via OAuth Discord sans mot de passe défini.
    "password_hash"      TEXT,
    "role"               "Role"       NOT NULL DEFAULT 'MEMBER',
    "status"             "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    -- Limite de pages pour un compte membre. NULL = limite par défaut
    -- (1 page). Un admin est toujours illimité, quel que soit ce champ.
    "page_limit"         INTEGER,
    "email_verified"     BOOLEAN      NOT NULL DEFAULT FALSE,
    "email_verified_at"  TIMESTAMP(3),
    "discord_id"         TEXT,
    "discord_username"   TEXT,
    "discord_avatar"     TEXT,
    "two_factor_enabled" BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Secret TOTP chiffré en AES-256-GCM, jamais en clair.
    "two_factor_secret"  TEXT,
    -- Hashs SHA-256 des codes de secours à usage unique.
    "two_factor_backup_codes" TEXT[]  NOT NULL DEFAULT '{}',
    "status_reason"      TEXT,
    "suspended_until"    TIMESTAMP(3),
    -- Badges attribués par un admin (ex: ["verified", "admin"]). Tableau de
    -- chaînes : ajouter un badge ne demande aucune migration.
    "badges"             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at"      TIMESTAMP(3)
);

CREATE UNIQUE INDEX "users_username_key"       ON "users" ("username");
-- La contrainte qui compte vraiment : elle empêche « Olgy » et « olgy »
-- de coexister.
CREATE UNIQUE INDEX "users_username_lower_key" ON "users" ("username_lower");
CREATE UNIQUE INDEX "users_email_key"          ON "users" ("email");
CREATE UNIQUE INDEX "users_discord_id_key" ON "users" ("discord_id");
CREATE INDEX "users_status_idx"            ON "users" ("status");
CREATE INDEX "users_created_at_idx"        ON "users" ("created_at");

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

CREATE TABLE "sessions" (
    "id"                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"            UUID         NOT NULL,
    -- Hash SHA-256 du refresh token : jamais le token en clair.
    "refresh_token_hash" TEXT         NOT NULL,
    "user_agent"         TEXT,
    "ip_address"         TEXT,
    "expires_at"         TIMESTAMP(3) NOT NULL,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions" ("refresh_token_hash");
CREATE INDEX "sessions_user_id_idx"                   ON "sessions" ("user_id");
CREATE INDEX "sessions_expires_at_idx"                ON "sessions" ("expires_at");

-- ---------------------------------------------------------------------------
-- verification_tokens
-- ---------------------------------------------------------------------------

CREATE TABLE "verification_tokens" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"    UUID         NOT NULL,
    "type"       "TokenType"  NOT NULL,
    "token_hash" TEXT         NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens" ("token_hash");
CREATE INDEX "verification_tokens_user_id_type_idx"      ON "verification_tokens" ("user_id", "type");
CREATE INDEX "verification_tokens_expires_at_idx"        ON "verification_tokens" ("expires_at");

-- ---------------------------------------------------------------------------
-- biolinks
-- ---------------------------------------------------------------------------

CREATE TABLE "biolinks" (
    "id"                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id"               UUID         NOT NULL,
    "slug"                   VARCHAR(64)  NOT NULL,
    "title"                  VARCHAR(120),
    "description"            VARCHAR(500),
    -- JSONB : personnalisation libre, validée applicativement par zod.
    "theme_config"           JSONB        NOT NULL DEFAULT '{}',
    "is_published"           BOOLEAN      NOT NULL DEFAULT FALSE,
    "is_password_protected"  BOOLEAN      NOT NULL DEFAULT FALSE,
    "password_hash"          TEXT,
    -- Suspension temporaire par la modération : tant que la date n'est pas
    -- passée, la page affiche un écran « page suspendue » et l'auteur ne
    -- peut ni la dépublier ni la republier. Expire d'elle-même.
    "suspended_until"        TIMESTAMP(3),
    "suspension_reason"      TEXT,
    "seo_title"              VARCHAR(120),
    "seo_description"        VARCHAR(300),
    "og_image_url"           TEXT,
    "custom_domain"          TEXT,
    "custom_domain_verified" BOOLEAN      NOT NULL DEFAULT FALSE,
    "total_views"            INTEGER      NOT NULL DEFAULT 0,
    -- Vues uniques : un navigateur par fenêtre de 24 h. C'est ce que le
    -- compteur public affiche (le total, lui, sert à l'analytique).
    "unique_views"           INTEGER      NOT NULL DEFAULT 0,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biolinks_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE,

    -- Cohérence : une page protégée doit porter un hash de mot de passe.
    CONSTRAINT "biolinks_password_coherence_check"
        CHECK (NOT "is_password_protected" OR "password_hash" IS NOT NULL)
);

CREATE UNIQUE INDEX "biolinks_slug_key"          ON "biolinks" ("slug");
CREATE UNIQUE INDEX "biolinks_custom_domain_key" ON "biolinks" ("custom_domain");
CREATE INDEX "biolinks_owner_id_idx"             ON "biolinks" ("owner_id");
CREATE INDEX "biolinks_is_published_idx"         ON "biolinks" ("is_published");

-- ---------------------------------------------------------------------------
-- links
-- ---------------------------------------------------------------------------

CREATE TABLE "links" (
    "id"         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    "biolink_id" UUID          NOT NULL,
    "label"      VARCHAR(80)   NOT NULL,
    "url"        VARCHAR(2048) NOT NULL,
    "icon"       VARCHAR(255),
    "position"   INTEGER       NOT NULL,
    "is_enabled" BOOLEAN       NOT NULL DEFAULT TRUE,
    "clicks"     INTEGER       NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "links_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE CASCADE
);

CREATE INDEX "links_biolink_id_position_idx" ON "links" ("biolink_id", "position");

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------

CREATE TABLE "blocks" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "biolink_id" UUID         NOT NULL,
    -- Clé du registry applicatif (lib/blocks/registry.ts). Volontairement
    -- VARCHAR et non ENUM : ajouter un type de block ne doit pas coûter
    -- une migration.
    "type"       VARCHAR(48)  NOT NULL,
    "config"     JSONB        NOT NULL DEFAULT '{}',
    "position"   INTEGER      NOT NULL,
    "is_enabled" BOOLEAN      NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE CASCADE
);

CREATE INDEX "blocks_biolink_id_position_idx" ON "blocks" ("biolink_id", "position");

-- ---------------------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------------------

CREATE TABLE "media_assets" (
    "id"         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id"   UUID          NOT NULL,
    "biolink_id" UUID,
    "type"       "MediaType"   NOT NULL,
    "key"        VARCHAR(512)  NOT NULL,
    "url"        VARCHAR(1024) NOT NULL,
    "mime_type"  VARCHAR(128)  NOT NULL,
    "size_bytes" INTEGER       NOT NULL,
    "created_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "media_assets_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "media_assets_key_key"           ON "media_assets" ("key");
CREATE INDEX "media_assets_owner_id_idx"             ON "media_assets" ("owner_id");
CREATE INDEX "media_assets_biolink_id_type_idx"      ON "media_assets" ("biolink_id", "type");

-- ---------------------------------------------------------------------------
-- analytics
-- ---------------------------------------------------------------------------

CREATE TABLE "analytics" (
    "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "biolink_id"     UUID         NOT NULL,
    "date"           DATE         NOT NULL,
    "views"          INTEGER      NOT NULL DEFAULT 0,
    "unique_views"   INTEGER      NOT NULL DEFAULT 0,
    "clicks_by_link" JSONB        NOT NULL DEFAULT '{}',
    "referrers"      JSONB        NOT NULL DEFAULT '{}',
    "countries"      JSONB        NOT NULL DEFAULT '{}',
    "devices"        JSONB        NOT NULL DEFAULT '{}',

    CONSTRAINT "analytics_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE CASCADE
);

-- Contrainte porteuse : rend l'agrégation quotidienne idempotente via
-- INSERT ... ON CONFLICT (biolink_id, date) DO UPDATE.
CREATE UNIQUE INDEX "analytics_biolink_id_date_key" ON "analytics" ("biolink_id", "date");
CREATE INDEX "analytics_date_idx"                   ON "analytics" ("date");

-- ---------------------------------------------------------------------------
-- view_fingerprints
-- Empreinte d'un navigateur pour le comptage des vues uniques. Un identifiant
-- aléatoire généré par le navigateur (localStorage) est hashé côté serveur ;
-- la ligne vit 24 h, après quoi le même navigateur redevient un visiteur
-- unique. Sert de dédoublonnage même sans Redis.
-- ---------------------------------------------------------------------------

CREATE TABLE "view_fingerprints" (
    "id"           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "biolink_id"   UUID         NOT NULL,
    "fingerprint"  VARCHAR(64)  NOT NULL,
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "last_seen_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "view_fingerprints_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE CASCADE
);

-- Un navigateur = une ligne par page : la contrainte porteuse du dédoublonnage.
CREATE UNIQUE INDEX "view_fingerprints_biolink_id_fingerprint_key"
    ON "view_fingerprints" ("biolink_id", "fingerprint");
CREATE INDEX "view_fingerprints_last_seen_at_idx" ON "view_fingerprints" ("last_seen_at");

-- ---------------------------------------------------------------------------
-- admin_logs
-- ---------------------------------------------------------------------------

CREATE TABLE "admin_logs" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "admin_id"    UUID         NOT NULL,
    "action"      VARCHAR(64)  NOT NULL,
    "target_type" VARCHAR(32),
    "target_id"   TEXT,
    "metadata"    JSONB        NOT NULL DEFAULT '{}',
    "ip_address"  TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_admin_id_fkey"
        FOREIGN KEY ("admin_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "admin_logs_admin_id_idx"             ON "admin_logs" ("admin_id");
CREATE INDEX "admin_logs_created_at_idx"           ON "admin_logs" ("created_at");
CREATE INDEX "admin_logs_target_type_target_id_idx" ON "admin_logs" ("target_type", "target_id");

-- ---------------------------------------------------------------------------
-- reserved_slugs
-- ---------------------------------------------------------------------------

CREATE TABLE "reserved_slugs" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "slug"       VARCHAR(64)  NOT NULL,
    "tier"       "SlugTier"   NOT NULL DEFAULT 'RESERVED',
    "reason"     VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "reserved_slugs_slug_key" ON "reserved_slugs" ("slug");

-- ---------------------------------------------------------------------------
-- slug_blacklist : mots interdits dans les slugs (insultes, marques...)
-- ---------------------------------------------------------------------------

CREATE TABLE "slug_blacklist" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "word"       VARCHAR(64)  NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "slug_blacklist_word_key" ON "slug_blacklist" ("word");


-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------

CREATE TABLE "reports" (
    "id"              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "biolink_id"      UUID           NOT NULL,
    "reporter_id"     UUID,
    "reason"          VARCHAR(64)    NOT NULL,
    "details"         VARCHAR(1000),
    "status"          "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by"     UUID,
    "resolved_at"     TIMESTAMP(3),
    "resolution_note" VARCHAR(1000),
    "created_at"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE CASCADE,
    CONSTRAINT "reports_reporter_id_fkey"
        FOREIGN KEY ("reporter_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "reports_status_created_at_idx" ON "reports" ("status", "created_at");
CREATE INDEX "reports_biolink_id_idx"        ON "reports" ("biolink_id");

-- ---------------------------------------------------------------------------
-- suspensions
-- ---------------------------------------------------------------------------
-- Historique immuable des suspensions de page : une ligne par suspension
-- décidée par la modération. On n'en modifie jamais une ligne : une
-- resuspension ajoute une nouvelle entrée.

-- ---------------------------------------------------------------------------
-- email_logs : historique de chaque email que le système a tenté d'envoyer.
-- Ne stocke jamais le contenu sensible (tokens, mots de passe) — seulement
-- le destinataire, le type, le sujet et l'issue de l'envoi.
-- ---------------------------------------------------------------------------

CREATE TYPE "EmailType"   AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_UNSUSPENDED', 'TWO_FACTOR_CHANGED');
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "email_logs" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"             UUID,
    "email"               VARCHAR(255) NOT NULL,
    "type"                "EmailType" NOT NULL,
    "status"              "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "subject"             VARCHAR(255),
    "provider_message_id" VARCHAR(255),
    "error"               VARCHAR(1000),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "email_logs_user_id_idx"     ON "email_logs" ("user_id");
CREATE INDEX "email_logs_type_idx"        ON "email_logs" ("type");
CREATE INDEX "email_logs_created_at_idx"  ON "email_logs" ("created_at");

CREATE TABLE "suspensions" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "biolink_id" UUID         NOT NULL,
    "admin_id"   UUID         NOT NULL,
    "reason"     VARCHAR(500) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "until"      TIMESTAMP(3),
    "lifted_at"  TIMESTAMP(3),

    CONSTRAINT "suspensions_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE CASCADE,
    CONSTRAINT "suspensions_admin_id_fkey"
        FOREIGN KEY ("admin_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "suspensions_biolink_id_started_at_idx" ON "suspensions" ("biolink_id", "started_at");
CREATE INDEX "suspensions_admin_id_idx"              ON "suspensions" ("admin_id");

-- ---------------------------------------------------------------------------
-- Quota : nombre maximal de biolinks par membre (1 par défaut, ajustable par
-- compte via users.page_limit, illimité pour un admin)
--
-- La règle est appliquée dans la couche API (lib/biolinks/access.ts), mais on
-- la double ici. Deux requêtes concurrentes peuvent passer un contrôle
-- applicatif "compter puis insérer" ; le trigger, lui, s'exécute dans la
-- transaction de l'INSERT et ferme la fenêtre de course.
--
-- Un index unique partiel ne suffit pas : la condition dépend de users.role
-- et users.page_limit, qui ne sont pas des colonnes de biolinks.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_member_biolink_quota()
RETURNS TRIGGER AS $$
DECLARE
    owner_role "Role";
    owner_limit INTEGER;
    existing_count INTEGER;
BEGIN
    -- FOR UPDATE : sérialise les insertions concurrentes du même propriétaire.
    SELECT "role", COALESCE("page_limit", 1) INTO owner_role, owner_limit
    FROM "users"
    WHERE "id" = NEW."owner_id"
    FOR UPDATE;

    IF owner_role = 'ADMIN' THEN
        RETURN NEW; -- biolinks illimités
    END IF;

    SELECT COUNT(*) INTO existing_count
    FROM "biolinks"
    WHERE "owner_id" = NEW."owner_id"
      AND "id" <> NEW."id";

    IF existing_count >= owner_limit THEN
        RAISE EXCEPTION 'MEMBER_BIOLINK_QUOTA_EXCEEDED: limite de % biolink(s) pour ce membre atteinte', owner_limit
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "biolinks_enforce_member_quota"
    BEFORE INSERT ON "biolinks"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_member_biolink_quota();

-- Rétrograder un admin en membre alors qu'il possède plus de biolinks que la
-- limite du compte ne le permet laisserait la base dans un état violant le
-- quota. On refuse le passage tant que ses biolinks excédentaires n'ont pas
-- été supprimés ou réattribués.
CREATE OR REPLACE FUNCTION enforce_quota_on_role_change()
RETURNS TRIGGER AS $$
DECLARE
    owned_count INTEGER;
    allowed INTEGER;
BEGIN
    IF OLD."role" = 'ADMIN' AND NEW."role" = 'MEMBER' THEN
        allowed := COALESCE(NEW."page_limit", 1);

        SELECT COUNT(*) INTO owned_count
        FROM "biolinks"
        WHERE "owner_id" = NEW."id";

        IF owned_count > allowed THEN
            RAISE EXCEPTION 'ROLE_DOWNGRADE_BLOCKED: cet utilisateur possède % biolinks, sa limite est de %', owned_count, allowed
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_enforce_quota_on_role_change"
    BEFORE UPDATE OF "role" ON "users"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_quota_on_role_change();

COMMIT;
