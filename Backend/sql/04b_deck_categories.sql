CREATE TABLE IF NOT EXISTS deck_categories (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT deck_categories_deck_name_unique UNIQUE (deck_id, name)
);

CREATE INDEX IF NOT EXISTS idx_deck_categories_deck_sort
    ON deck_categories (deck_id, sort_order);
