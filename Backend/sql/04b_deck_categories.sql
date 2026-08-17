-- User-defined (or app-seeded) card sections per deck.
-- Default names (Entity / Cyberspell) are inserted by the API on deck create.
CREATE TABLE IF NOT EXISTS deck_categories (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    in_deck BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT deck_categories_deck_name_unique UNIQUE (deck_id, name)
);

CREATE INDEX IF NOT EXISTS idx_deck_categories_deck_sort
    ON deck_categories (deck_id, sort_order);

COMMENT ON TABLE deck_categories IS 'User-defined (or seeded) card sections per deck.';
COMMENT ON COLUMN deck_categories.in_deck IS 'When false, the section is a list only and is not part of the RIG.';
