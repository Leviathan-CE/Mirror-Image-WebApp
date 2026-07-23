-- Restrict publish_cards.published to the three catalogue visibility states.
-- Idempotent.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'publish_cards_published_allowed'
    ) THEN
        ALTER TABLE publish_cards
            ADD CONSTRAINT publish_cards_published_allowed
            CHECK (published IN ('published', 'preview', 'not published'));
    END IF;
END $$;

COMMENT ON COLUMN publish_cards.published IS
    'Catalogue visibility: published | preview | not published.';
