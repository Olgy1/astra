-- page_limit = -1 signifie désormais « illimité » pour un membre (choisi par
-- un admin). Le trigger de quota doit le traiter comme illimité, sinon -1
-- bloquerait toute création de page (existing_count >= -1 est toujours vrai).

CREATE OR REPLACE FUNCTION enforce_member_biolink_quota()
RETURNS TRIGGER AS $$
DECLARE
    owner_role "Role";
    owner_limit INTEGER;
    existing_count INTEGER;
BEGIN
    -- FOR UPDATE : sérialise les insertions concurrentes du même propriétaire.
    SELECT "role", "page_limit" INTO owner_role, owner_limit
    FROM "users"
    WHERE "id" = NEW."owner_id"
    FOR UPDATE;

    IF owner_role = 'ADMIN' OR owner_limit = -1 THEN
        RETURN NEW; -- biolinks illimités (admin, ou limite -1)
    END IF;

    owner_limit := COALESCE(owner_limit, 1);

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

CREATE OR REPLACE FUNCTION enforce_quota_on_role_change()
RETURNS TRIGGER AS $$
DECLARE
    owned_count INTEGER;
    allowed INTEGER;
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
