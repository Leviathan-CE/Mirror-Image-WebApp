-- Public announcement board + reusable staff image library.
CREATE TABLE IF NOT EXISTS announcement_media (
    id BIGSERIAL PRIMARY KEY,
    storage_key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT '',
    byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 1048576),
    created_by BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT announcement_media_key_not_blank CHECK (length(trim(storage_key)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_announcement_media_label_lower
    ON announcement_media (lower(label));

CREATE TABLE IF NOT EXISTS announcements (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    cover_kind TEXT NOT NULL DEFAULT 'image',
    cover_media_id BIGINT NULL REFERENCES announcement_media (id) ON DELETE SET NULL,
    cover_card_id BIGINT NULL REFERENCES cards (id) ON DELETE SET NULL,
    cover_card_face TEXT NULL,
    cover_youtube_id TEXT NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
    updated_by BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT announcements_title_not_blank CHECK (length(trim(title)) > 0),
    CONSTRAINT announcements_slug_not_blank CHECK (length(trim(slug)) > 0),
    CONSTRAINT announcements_status_allowed CHECK (status IN ('draft', 'published')),
    CONSTRAINT announcements_cover_kind_allowed CHECK (
        cover_kind IN ('image', 'youtube', 'card')
    ),
    CONSTRAINT announcements_cover_face_allowed CHECK (
        cover_card_face IS NULL OR cover_card_face IN ('art', 'thumb')
    )
);

CREATE INDEX IF NOT EXISTS idx_announcements_published
    ON announcements (published_at DESC NULLS LAST)
    WHERE status = 'published';

COMMENT ON TABLE announcement_media IS
    'Reusable staff uploads for announcements. Not deleted when a post is removed.';
COMMENT ON TABLE announcements IS
    'Public board posts. body_markdown is source only — never stored HTML.';
