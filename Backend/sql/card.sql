-- Maps Unity CardData (ScriptableObject) to Postgres.
-- Artwork: full-size + thumbnail BYTEA; pixel width/height for layout without decoding.
-- Lists (cost, superTypes, subTypes, keyWords) → JSONB.

CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,

    is_deprecated   BOOLEAN NOT NULL DEFAULT FALSE,
    card_set_name TEXT NOT NULL DEFAULT 'BASE',
    card_name       TEXT NOT NULL DEFAULT '',

    artwork_data          BYTEA,
    artwork_mime_type     TEXT, --image/png
    artwork_width_px      INTEGER,
    artwork_height_px     INTEGER,

    artwork_thumbnail_data      BYTEA,
    artwork_thumbnail_mime_type TEXT, --image/webp
    artwork_thumbnail_width_px  INTEGER,
    artwork_thumbnail_height_px INTEGER,

    cost         JSONB NOT NULL DEFAULT '[]'::jsonb,
    invoke_cost INTEGER NOT NULL DEFAULT 0,
    super_types  JSONB NOT NULL DEFAULT '[]'::jsonb,
    sub_types    JSONB NOT NULL DEFAULT '[]'::jsonb,

    types_line   TEXT NOT NULL DEFAULT '',

    keywords     JSONB NOT NULL DEFAULT '[]'::jsonb,

    show_help_text BOOLEAN NOT NULL DEFAULT TRUE,
    description    TEXT NOT NULL DEFAULT '',

    rarity       TEXT NOT NULL DEFAULT 'Common',

    artist_name  TEXT NOT NULL DEFAULT 'Levi Boswell AI assisted',
    card_number  INTEGER NOT NULL DEFAULT 0,
    card_count   INTEGER NOT NULL DEFAULT -1,
    legal_info   TEXT NOT NULL DEFAULT '© 2026 Leviathan Creative Entertiament.',

    is_summon    BOOLEAN NOT NULL DEFAULT FALSE,
    atk          INTEGER NOT NULL DEFAULT 0,
    def          INTEGER NOT NULL DEFAULT 0,

    is_pilot     BOOLEAN NOT NULL DEFAULT FALSE,

    ram_capacity INTEGER NOT NULL DEFAULT 0,
    pow_capacity INTEGER NOT NULL DEFAULT 0,
    met_capacity INTEGER NOT NULL DEFAULT 0,
    lif_capacity INTEGER NOT NULL DEFAULT 0,
    hand_size    INTEGER NOT NULL DEFAULT 0,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    Lagality TEXT NOT NULL DEFAULT 'Legal'

    CONSTRAINT cards_atk_non_negative CHECK (atk >= 0),
    CONSTRAINT cards_def_non_negative CHECK (def >= 0),
    CONSTRAINT cards_capacities_non_negative CHECK (
        ram_capacity >= 0 AND pow_capacity >= 0 AND met_capacity >= 0
        AND lif_capacity >= 0 AND hand_size >= 0
    ),
    CONSTRAINT cards_artwork_dims_positive CHECK (
        (artwork_width_px IS NULL OR artwork_width_px > 0)
        AND (artwork_height_px IS NULL OR artwork_height_px > 0)
    ),
    CONSTRAINT cards_thumb_dims_positive CHECK (
        (artwork_thumbnail_width_px IS NULL OR artwork_thumbnail_width_px > 0)
        AND (artwork_thumbnail_height_px IS NULL OR artwork_thumbnail_height_px > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_cards_card_name ON cards (card_name);
CREATE INDEX IF NOT EXISTS idx_cards_is_deprecated ON cards (is_deprecated);
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards (rarity);
CREATE INDEX IF NOT EXISTS idx_cards_card_number ON cards (card_number);

-- B-tree on pixel sizes (only rows that have bytes); useful for layout queries / filters.
CREATE INDEX IF NOT EXISTS idx_cards_artwork_pixel_size
    ON cards (artwork_width_px, artwork_height_px)
    WHERE artwork_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_thumbnail_pixel_size
    ON cards (artwork_thumbnail_width_px, artwork_thumbnail_height_px)
    WHERE artwork_thumbnail_data IS NOT NULL;

COMMENT ON TABLE cards IS 'CardData ScriptableObject — lists as JSONB.';
COMMENT ON COLUMN cards.artwork_data IS 'Full-size image bytes (PNG/JPEG/WebP).';
COMMENT ON COLUMN cards.artwork_mime_type IS 'Content-Type for full artwork (e.g. image/png).';
COMMENT ON COLUMN cards.artwork_width_px IS 'Full image width in pixels (layout / Unity rects).';
COMMENT ON COLUMN cards.artwork_height_px IS 'Full image height in pixels.';
COMMENT ON COLUMN cards.artwork_thumbnail_data IS 'Smaller copy for lists / deck builder.';
COMMENT ON COLUMN cards.artwork_thumbnail_mime_type IS 'Content-Type for thumbnail.';
COMMENT ON COLUMN cards.artwork_thumbnail_width_px IS 'Thumbnail width in pixels.';
COMMENT ON COLUMN cards.artwork_thumbnail_height_px IS 'Thumbnail height in pixels.';
COMMENT ON COLUMN cards.cost IS 'List<Costs> as JSON array';
COMMENT ON COLUMN cards.super_types IS 'List<SuperType> as JSON array';
COMMENT ON COLUMN cards.sub_types IS 'List<SubTpye> as JSON array';
COMMENT ON COLUMN cards.keywords IS 'List<KeyWords> as JSON array';
COMMENT ON COLUMN cards.rarity IS 'CardRarity as string enum name';

-- Migration snippets (adjust if your live table differs):
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS artwork_thumbnail_data BYTEA;
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS artwork_thumbnail_mime_type TEXT;
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS artwork_width_px INTEGER;
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS artwork_height_px INTEGER;
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS artwork_thumbnail_width_px INTEGER;
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS artwork_thumbnail_height_px INTEGER;
-- CREATE INDEX IF NOT EXISTS idx_cards_artwork_pixel_size ON cards (artwork_width_px, artwork_height_px) WHERE artwork_data IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_cards_thumbnail_pixel_size ON cards (artwork_thumbnail_width_px, artwork_thumbnail_height_px) WHERE artwork_thumbnail_data IS NOT NULL;
