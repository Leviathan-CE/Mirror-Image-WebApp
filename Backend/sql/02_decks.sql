-- Deck cover art paths used by the deck builder API.
CREATE TABLE IF NOT EXISTS decks(
    id BIGSERIAL PRIMARY KEY,

    name TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    cover_image_path TEXT DEFAULT NULL,
    cover_image_mime_type TEXT DEFAULT NULL,
    -- Community counters (separate metrics).
    -- Who liked lives in deck_likes; this is the cached total for sort/display.
    like_count BIGINT NOT NULL DEFAULT 0,
    -- Detail-page opens (owner self-views excluded in the API).
    view_count BIGINT NOT NULL DEFAULT 0
);

COMMENT ON COLUMN decks.cover_image_path IS 'Relative path under /thumbnails for deck cover art.';
COMMENT ON COLUMN decks.cover_image_mime_type IS 'Content-Type for deck cover image (e.g. image/png).';
COMMENT ON COLUMN decks.like_count IS
    'Cached number of likes; source of truth for membership is deck_likes.';
COMMENT ON COLUMN decks.view_count IS
    'How many times the deck detail page was opened (owner self-views excluded).';
