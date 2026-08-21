-- Community deck engagement: views, likes, user tags.
-- Fresh installs also get counters via 02_decks.sql + tables via 13_deck_community.sql

ALTER TABLE decks
    ADD COLUMN IF NOT EXISTS like_count BIGINT NOT NULL DEFAULT 0;

ALTER TABLE decks
    ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN decks.like_count IS
    'Cached number of likes; source of truth for membership is deck_likes.';
COMMENT ON COLUMN decks.view_count IS
    'How many times the deck detail page was opened (owner self-views excluded).';

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

-- Sync cached like totals from membership rows.
UPDATE decks d
   SET like_count = (
        SELECT COUNT(*)::bigint FROM deck_likes dl WHERE dl.deck_id = d.id
   );
