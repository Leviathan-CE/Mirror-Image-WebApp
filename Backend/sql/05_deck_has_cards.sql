CREATE TABLE IF NOT EXISTS deck_has_cards (
 deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
 card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
 quantity INT NOT NULL CHECK (quantity > 0),
 PRIMARY KEY (deck_id, card_id)
);