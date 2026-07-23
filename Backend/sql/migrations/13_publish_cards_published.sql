-- Add published status for existing databases (idempotent).
-- Replaces legacy is_public boolean when present.

ALTER TABLE publish_cards
    ADD COLUMN IF NOT EXISTS published TEXT NOT NULL DEFAULT 'not published';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'publish_cards'
          AND column_name = 'is_public'
    ) THEN
        UPDATE publish_cards
        SET published = CASE
            WHEN is_public THEN 'published'
            ELSE 'not published'
        END;

        ALTER TABLE publish_cards
            DROP COLUMN is_public;
    END IF;
END $$;
