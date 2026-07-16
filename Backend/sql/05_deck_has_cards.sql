CREATE TABLE IF NOT EXISTS deck_has_cards (
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES deck_categories(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (deck_id, card_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_has_cards_deck_category_sort
    ON deck_has_cards (deck_id, category_id, sort_order);
