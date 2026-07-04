CREATE TABLE IF NOT EXISTS user_has_decks (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, deck_id)
);