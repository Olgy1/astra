-- Alias : adresse courte qui redirige vers la page bio d'un compte.
-- alias_limit NULL = 2 par défaut pour un membre, -1 = illimité, illimité
-- pour un admin (règle appliquée en base comme pour les biolinks).

ALTER TABLE "users" ADD COLUMN "alias_limit" INTEGER;

CREATE TABLE "aliases" (
    "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id"   UUID         NOT NULL,
    "biolink_id" UUID         NOT NULL,
    "slug"       VARCHAR(64)  NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aliases_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "aliases_biolink_id_fkey"
        FOREIGN KEY ("biolink_id") REFERENCES "biolinks" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "aliases_slug_key"        ON "aliases" ("slug");
CREATE INDEX "aliases_owner_id_idx"           ON "aliases" ("owner_id");
CREATE INDEX "aliases_biolink_id_idx"         ON "aliases" ("biolink_id");

-- Quota d'alias par membre (2 par défaut, -1 = illimité, illimité pour un
-- admin). Même motif que le quota de biolinks : la couche API fait un contrôle
-- indicatif, ce trigger ferme la fenêtre de course dans la transaction d'INSERT.
CREATE OR REPLACE FUNCTION enforce_member_alias_quota()
RETURNS TRIGGER AS $$
DECLARE
    owner_role "Role";
    owner_limit INTEGER;
    existing_count INTEGER;
BEGIN
    SELECT "role", "alias_limit" INTO owner_role, owner_limit
    FROM "users"
    WHERE "id" = NEW."owner_id"
    FOR UPDATE;

    IF owner_role = 'ADMIN' OR owner_limit = -1 THEN
        RETURN NEW; -- alias illimités (admin, ou limite -1)
    END IF;

    owner_limit := COALESCE(owner_limit, 2);

    SELECT COUNT(*) INTO existing_count
    FROM "aliases"
    WHERE "owner_id" = NEW."owner_id"
      AND "id" <> NEW."id";

    IF existing_count >= owner_limit THEN
        RAISE EXCEPTION 'MEMBER_ALIAS_QUOTA_EXCEEDED: limite de % alias pour ce membre atteinte', owner_limit
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "aliases_enforce_member_quota"
    BEFORE INSERT ON "aliases"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_member_alias_quota();

-- Rétrograder un admin en membre : vérifie aussi le quota d'alias, pas
-- seulement celui des biolinks.
CREATE OR REPLACE FUNCTION enforce_quota_on_role_change()
RETURNS TRIGGER AS $$
DECLARE
    owned_count INTEGER;
    alias_count INTEGER;
    allowed INTEGER;
    alias_allowed INTEGER;
BEGIN
    IF OLD."role" = 'ADMIN' AND NEW."role" = 'MEMBER' THEN
        -- page_limit = -1 signifie « illimité » : aucune vérification à faire.
        IF NEW."page_limit" <> -1 THEN
            allowed := COALESCE(NEW."page_limit", 1);

            SELECT COUNT(*) INTO owned_count
            FROM "biolinks"
            WHERE "owner_id" = NEW."id";

            IF owned_count > allowed THEN
                RAISE EXCEPTION 'ROLE_DOWNGRADE_BLOCKED: cet utilisateur possède % biolinks, sa limite est de %', owned_count, allowed
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;

        IF NEW."alias_limit" <> -1 THEN
            alias_allowed := COALESCE(NEW."alias_limit", 2);

            SELECT COUNT(*) INTO alias_count
            FROM "aliases"
            WHERE "owner_id" = NEW."id";

            IF alias_count > alias_allowed THEN
                RAISE EXCEPTION 'ROLE_DOWNGRADE_BLOCKED: cet utilisateur possède % alias, sa limite est de %', alias_count, alias_allowed
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
