-- « Se souvenir de moi » : les sessions existantes restent persistantes
-- (comportement d'avant), les nouvelles pourront être éphémères.
ALTER TABLE "sessions" ADD COLUMN "persistent" BOOLEAN NOT NULL DEFAULT TRUE;
