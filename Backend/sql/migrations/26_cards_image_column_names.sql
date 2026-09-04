-- Canonical image columns: card_thumbnail_* (full card) + illustration_thumbnail_* (art only).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'printed_card_path'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'card_thumbnail_path'
    ) THEN
        ALTER TABLE cards RENAME COLUMN printed_card_path TO card_thumbnail_path;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'printed_card_mime_type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'card_thumbnail_mime_type'
    ) THEN
        ALTER TABLE cards RENAME COLUMN printed_card_mime_type TO card_thumbnail_mime_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'illustration_path'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'illustration_thumbnail_path'
    ) THEN
        ALTER TABLE cards RENAME COLUMN illustration_path TO illustration_thumbnail_path;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'illustration_mime_type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'illustration_thumbnail_mime_type'
    ) THEN
        ALTER TABLE cards RENAME COLUMN illustration_mime_type TO illustration_thumbnail_mime_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'card_art_path'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'illustration_thumbnail_path'
    ) THEN
        ALTER TABLE cards RENAME COLUMN card_art_path TO illustration_thumbnail_path;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'card_art_mime_type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'illustration_thumbnail_mime_type'
    ) THEN
        ALTER TABLE cards RENAME COLUMN card_art_mime_type TO illustration_thumbnail_mime_type;
    END IF;
END $$;

ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS card_thumbnail_path TEXT DEFAULT NULL;
ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS card_thumbnail_mime_type TEXT DEFAULT NULL;
ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS illustration_thumbnail_path TEXT DEFAULT NULL;
ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS illustration_thumbnail_mime_type TEXT DEFAULT NULL;

-- Copy into target columns when legacy names still exist alongside new ones.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'printed_card_path'
    ) THEN
        UPDATE cards
           SET card_thumbnail_path = COALESCE(card_thumbnail_path, printed_card_path),
               card_thumbnail_mime_type = COALESCE(card_thumbnail_mime_type, printed_card_mime_type)
         WHERE printed_card_path IS NOT NULL;
        ALTER TABLE cards DROP COLUMN IF EXISTS printed_card_path;
        ALTER TABLE cards DROP COLUMN IF EXISTS printed_card_mime_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'illustration_path'
    ) THEN
        UPDATE cards
           SET illustration_thumbnail_path = COALESCE(illustration_thumbnail_path, illustration_path),
               illustration_thumbnail_mime_type = COALESCE(
                   illustration_thumbnail_mime_type, illustration_mime_type
               )
         WHERE illustration_path IS NOT NULL;
        ALTER TABLE cards DROP COLUMN IF EXISTS illustration_path;
        ALTER TABLE cards DROP COLUMN IF EXISTS illustration_mime_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'card_art_path'
    ) THEN
        UPDATE cards
           SET illustration_thumbnail_path = COALESCE(illustration_thumbnail_path, card_art_path),
               illustration_thumbnail_mime_type = COALESCE(
                   illustration_thumbnail_mime_type, card_art_mime_type
               )
         WHERE card_art_path IS NOT NULL;
        ALTER TABLE cards DROP COLUMN IF EXISTS card_art_path;
        ALTER TABLE cards DROP COLUMN IF EXISTS card_art_mime_type;
    END IF;
END $$;

COMMENT ON COLUMN cards.card_thumbnail_path IS
    'Full-card PNG from Unity Assets/!thumbnail (POST /cards/{id}/thumbnail).';
COMMENT ON COLUMN cards.card_thumbnail_mime_type IS
    'Content-Type for full-card thumbnail (e.g. image/png).';
COMMENT ON COLUMN cards.illustration_thumbnail_path IS
    'Art-only PNG from Unity Assets/!thumb_art (POST /cards/{id}/art); exposed as card_art_path in API JSON.';
COMMENT ON COLUMN cards.illustration_thumbnail_mime_type IS
    'Content-Type for illustration thumb art (e.g. image/png).';
