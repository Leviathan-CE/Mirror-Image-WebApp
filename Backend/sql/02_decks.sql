-- Deck cover art paths used by the deck builder API.
CREATE TABLE IF NOT EXISTS decks(
    id BIGSERIAL PRIMARY KEY,

    name TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    cover_image_path TEXT DEFAULT NULL,
    cover_image_mime_type TEXT DEFAULT NULL
);

COMMENT ON COLUMN decks.cover_image_path IS 'Relative path under /thumbnails for deck cover art.';
COMMENT ON COLUMN decks.cover_image_mime_type IS 'Content-Type for deck cover image (e.g. image/png).';
