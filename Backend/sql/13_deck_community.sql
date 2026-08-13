-- Community engagement tables (fresh DB init). See migrations/24_deck_community.sql.
-- like_count / view_count live on decks in 02_decks.sql (fresh) or migration 24 (upgrade).
-- deck_likes stores *who* liked; decks.like_count is the denormalized total.

CREATE TABLE IF NOT EXISTS deck_likes (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    deck_id BIGINT NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
    liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, deck_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_likes_deck_id
    ON deck_likes (deck_id);

CREATE TABLE IF NOT EXISTS deck_tags (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_by BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT deck_tags_tag_not_blank CHECK (length(trim(tag)) > 0),
    CONSTRAINT deck_tags_tag_len CHECK (char_length(trim(tag)) BETWEEN 1 AND 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_tags_deck_tag_lower
    ON deck_tags (deck_id, lower(trim(tag)));

CREATE INDEX IF NOT EXISTS idx_deck_tags_tag_lower
    ON deck_tags (lower(trim(tag)));
