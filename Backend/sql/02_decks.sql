CREATE TABLE IF NOT EXISTS decks(
    id BIGSERIAL PRIMARY KEY,

    name TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    cover_image_path TEXT DEFAULT NULL,
    cover_image_mime_type TEXT DEFAULT NULL
);
