-- Deck cover image + per-entry category / sort order for deck builder API.
-- Safe to re-run.

ALTER TABLE decks
    ADD COLUMN IF NOT EXISTS cover_image_path TEXT DEFAULT NULL;

ALTER TABLE decks
    ADD COLUMN IF NOT EXISTS cover_image_mime_type TEXT DEFAULT NULL;

ALTER TABLE deck_has_cards
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'main';

ALTER TABLE deck_has_cards
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- Recreate PK as (deck_id, card_id, category) so a card can sit in main + side.
DO $$
BEGIN
    ALTER TABLE deck_has_cards DROP CONSTRAINT IF EXISTS deck_has_cards_pkey;
    ALTER TABLE deck_has_cards
        ADD CONSTRAINT deck_has_cards_pkey PRIMARY KEY (deck_id, card_id, category);
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_deck_has_cards_deck_category_sort
    ON deck_has_cards (deck_id, category, sort_order);

COMMENT ON COLUMN decks.cover_image_path IS 'Relative path under /thumbnails for deck cover art.';
COMMENT ON COLUMN deck_has_cards.category IS 'Deck section: main | side | maybe | extra';
COMMENT ON COLUMN deck_has_cards.sort_order IS 'Display order within a category (ascending).';
