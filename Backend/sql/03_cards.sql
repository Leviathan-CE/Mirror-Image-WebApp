-- Maps Unity CardData (ScriptableObject) to Postgres.
-- Artwork: full-size + thumbnail BYTEA; pixel width/height for layout without decoding.
-- Lists (cost, superTypes, subTypes, keyWords) → JSONB.

CREATE TABLE IF NOT EXISTS cards (

    -- Unity barcode id (CardData.ID, uint32); requires BIGINT not INTEGER.
    id BIGINT PRIMARY KEY,

    is_deprecated   BOOLEAN NOT NULL DEFAULT FALSE,
    card_name       TEXT NOT NULL DEFAULT '',

    cost         JSONB NOT NULL DEFAULT '[]'::jsonb,
    invoke_cost INTEGER NOT NULL DEFAULT 0,

    super_types  JSONB NOT NULL DEFAULT '[]'::jsonb,
    sub_types    JSONB NOT NULL DEFAULT '[]'::jsonb,
    types_line   TEXT NOT NULL DEFAULT '',

    card_art_path TEXT DEFAULT NULL,
    card_art_mime_type TEXT DEFAULT NULL,

    keywords     JSONB NOT NULL DEFAULT '[]'::jsonb,

    show_help_text BOOLEAN NOT NULL DEFAULT TRUE,
    description    TEXT NOT NULL DEFAULT '',

    rarity       TEXT NOT NULL DEFAULT 'Common',

    artist_name  TEXT NOT NULL DEFAULT 'Levi Boswell AI assisted',
    card_number  INTEGER NOT NULL DEFAULT 0,
    card_count   INTEGER NOT NULL DEFAULT -1,
    legal_info   TEXT NOT NULL DEFAULT '© 2026 Leviathan Creative Entertiament.',
    card_set_name     TEXT NOT NULL DEFAULT 'unassigned',
    card_printing TEXT NOT NULL DEFAULT 'standard',

    is_summon    BOOLEAN NOT NULL DEFAULT FALSE,
    is_augment BOOLEAN NOT NULL DEFAULT FALSE,
    is_pilot     BOOLEAN NOT NULL DEFAULT FALSE,

    threat_level          TEXT NOT NULL DEFAULT '0',    

    ram_capacity INTEGER NOT NULL DEFAULT 0,
    power_capacity INTEGER NOT NULL DEFAULT 0,
    metal_capacity INTEGER NOT NULL DEFAULT 0,
    spirit_capacity INTEGER NOT NULL DEFAULT 0,
    steel_capacity INTEGER NOT NULL DEFAULT 0,
    time_capacity INTEGER NOT NULL DEFAULT 0,

    lif_capacity INTEGER NOT NULL DEFAULT 0,
    hand_size    INTEGER NOT NULL DEFAULT 0,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    lagality TEXT NOT NULL DEFAULT 'Legal',

    CONSTRAINT cards_capacities_non_negative CHECK (
        ram_capacity >= 0 AND power_capacity >= 0 AND metal_capacity >= 0
        AND spirit_capacity >= 0 AND steel_capacity >= 0
        AND time_capacity >= 0
        AND lif_capacity >= 0 AND hand_size >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_cards_card_name ON cards (card_name);
CREATE INDEX IF NOT EXISTS idx_cards_is_deprecated ON cards (is_deprecated);
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards (rarity);
CREATE INDEX IF NOT EXISTS idx_cards_card_number ON cards (card_number);



COMMENT ON TABLE cards IS 'CardData ScriptableObject — lists as JSONB.';
COMMENT ON COLUMN cards.card_art_path IS 'Relative filesystem path for stored card image/thumbnail.';
COMMENT ON COLUMN cards.card_art_mime_type IS 'Content-Type for card image (e.g. image/png).';
COMMENT ON COLUMN cards.cost IS 'List<Costs> as JSON array';
COMMENT ON COLUMN cards.super_types IS 'List<SuperType> as JSON array';
COMMENT ON COLUMN cards.sub_types IS 'List<SubTpye> as JSON array';
COMMENT ON COLUMN cards.keywords IS 'List<KeyWords> as JSON array';
COMMENT ON COLUMN cards.rarity IS 'CardRarity as string enum name';


