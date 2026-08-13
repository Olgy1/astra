-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('AVATAR', 'BANNER', 'AUDIO', 'CURSOR', 'BACKGROUND', 'FONT');

-- CreateEnum
CREATE TYPE "SlugTier" AS ENUM ('RESERVED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_UNSUSPENDED', 'TWO_FACTOR_CHANGED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "username_lower" VARCHAR(32) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "page_limit" INTEGER,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "discord_id" TEXT,
    "discord_username" TEXT,
    "discord_avatar" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "badges" JSONB NOT NULL DEFAULT '[]',
    "two_factor_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status_reason" TEXT,
    "suspended_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biolinks" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(120),
    "description" VARCHAR(500),
    "theme_config" JSONB NOT NULL DEFAULT '{}',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_password_protected" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "suspended_until" TIMESTAMP(3),
    "suspension_reason" TEXT,
    "seo_title" VARCHAR(120),
    "seo_description" VARCHAR(300),
    "og_image_url" TEXT,
    "custom_domain" TEXT,
    "custom_domain_verified" BOOLEAN NOT NULL DEFAULT false,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "unique_views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biolinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" UUID NOT NULL,
    "biolink_id" UUID NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "icon" VARCHAR(255),
    "position" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL,
    "biolink_id" UUID NOT NULL,
    "type" VARCHAR(48) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "biolink_id" UUID,
    "type" "MediaType" NOT NULL,
    "key" VARCHAR(512) NOT NULL,
    "url" VARCHAR(1024) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics" (
    "id" UUID NOT NULL,
    "biolink_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "unique_views" INTEGER NOT NULL DEFAULT 0,
    "clicks_by_link" JSONB NOT NULL DEFAULT '{}',
    "referrers" JSONB NOT NULL DEFAULT '{}',
    "countries" JSONB NOT NULL DEFAULT '{}',
    "devices" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "type" "EmailType" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "subject" VARCHAR(255),
    "provider_message_id" VARCHAR(255),
    "error" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "view_fingerprints" (
    "id" UUID NOT NULL,
    "biolink_id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "view_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32),
    "target_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserved_slugs" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "tier" "SlugTier" NOT NULL DEFAULT 'RESERVED',
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserved_slugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_blacklist" (
    "id" UUID NOT NULL,
    "word" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "biolink_id" UUID NOT NULL,
    "reporter_id" UUID,
    "reason" VARCHAR(64) NOT NULL,
    "details" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspensions" (
    "id" UUID NOT NULL,
    "biolink_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "until" TIMESTAMP(3),
    "lifted_at" TIMESTAMP(3),

    CONSTRAINT "suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_lower_key" ON "users"("username_lower");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_discord_id_key" ON "users"("discord_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "verification_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "biolinks_slug_key" ON "biolinks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "biolinks_custom_domain_key" ON "biolinks"("custom_domain");

-- CreateIndex
CREATE INDEX "biolinks_owner_id_idx" ON "biolinks"("owner_id");

-- CreateIndex
CREATE INDEX "biolinks_is_published_idx" ON "biolinks"("is_published");

-- CreateIndex
CREATE INDEX "links_biolink_id_position_idx" ON "links"("biolink_id", "position");

-- CreateIndex
CREATE INDEX "blocks_biolink_id_position_idx" ON "blocks"("biolink_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_key_key" ON "media_assets"("key");

-- CreateIndex
CREATE INDEX "media_assets_owner_id_idx" ON "media_assets"("owner_id");

-- CreateIndex
CREATE INDEX "media_assets_biolink_id_type_idx" ON "media_assets"("biolink_id", "type");

-- CreateIndex
CREATE INDEX "analytics_date_idx" ON "analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_biolink_id_date_key" ON "analytics"("biolink_id", "date");

-- CreateIndex
CREATE INDEX "email_logs_user_id_idx" ON "email_logs"("user_id");

-- CreateIndex
CREATE INDEX "email_logs_type_idx" ON "email_logs"("type");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");

-- CreateIndex
CREATE INDEX "view_fingerprints_last_seen_at_idx" ON "view_fingerprints"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "view_fingerprints_biolink_id_fingerprint_key" ON "view_fingerprints"("biolink_id", "fingerprint");

-- CreateIndex
CREATE INDEX "admin_logs_admin_id_idx" ON "admin_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_logs_created_at_idx" ON "admin_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_logs_target_type_target_id_idx" ON "admin_logs"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reserved_slugs_slug_key" ON "reserved_slugs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "slug_blacklist_word_key" ON "slug_blacklist"("word");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_biolink_id_idx" ON "reports"("biolink_id");

-- CreateIndex
CREATE INDEX "suspensions_biolink_id_started_at_idx" ON "suspensions"("biolink_id", "started_at");

-- CreateIndex
CREATE INDEX "suspensions_admin_id_idx" ON "suspensions"("admin_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biolinks" ADD CONSTRAINT "biolinks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_biolink_id_fkey" FOREIGN KEY ("biolink_id") REFERENCES "biolinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_biolink_id_fkey" FOREIGN KEY ("biolink_id") REFERENCES "biolinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_biolink_id_fkey" FOREIGN KEY ("biolink_id") REFERENCES "biolinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_biolink_id_fkey" FOREIGN KEY ("biolink_id") REFERENCES "biolinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_fingerprints" ADD CONSTRAINT "view_fingerprints_biolink_id_fkey" FOREIGN KEY ("biolink_id") REFERENCES "biolinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_biolink_id_fkey" FOREIGN KEY ("biolink_id") REFERENCES "biolinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_biolink_id_fkey" FOREIGN KEY ("biolink_id") REFERENCES "biolinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Triggers de quota (équivalents SQL des contraintes applicatives)
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
