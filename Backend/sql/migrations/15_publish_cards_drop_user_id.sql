-- Drop per-user ownership from publish_cards; status is per card only.
-- Idempotent. Table is expected to be empty or to have one row per card_id.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'publish_cards'
          AND column_name = 'user_id'
    ) THEN
        -- Keep one row per card if duplicates exist (prefer 'published' > 'preview' > other).
        DELETE FROM publish_cards a
        USING publish_cards b
        WHERE a.user_id IS NOT NULL
          AND a.card_id = b.card_id
          AND a.ctid < b.ctid;

        ALTER TABLE publish_cards DROP CONSTRAINT IF EXISTS publish_cards_pkey;
        ALTER TABLE publish_cards DROP CONSTRAINT IF EXISTS publish_cards_user_id_fkey;
        ALTER TABLE publish_cards DROP COLUMN user_id;

        ALTER TABLE publish_cards
            ADD CONSTRAINT publish_cards_pkey PRIMARY KEY (card_id);
    END IF;
END $$;

COMMENT ON TABLE publish_cards IS 'Publication status for each catalogue card.';
COMMENT ON COLUMN publish_cards.published IS
    'Catalogue visibility: published | preview | not published.';
