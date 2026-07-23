-- Per-deck custom categories. Cards reference category_id instead of free text.
-- Idempotent migration for existing volumes.

CREATE TABLE IF NOT EXISTS deck_categories (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT deck_categories_deck_name_unique UNIQUE (deck_id, name)
);

CREATE INDEX IF NOT EXISTS idx_deck_categories_deck_sort
    ON deck_categories (deck_id, sort_order);

-- Seed default sections for every deck that has none yet.
INSERT INTO deck_categories (deck_id, name, sort_order)
SELECT d.id, defaults.name, defaults.sort_order
FROM decks d
CROSS JOIN (
    VALUES
        ('Main', 0),
        ('Side', 1),
        ('Maybe', 2),
        ('Extra', 3)
) AS defaults(name, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM deck_categories dc WHERE dc.deck_id = d.id
);

-- Ensure a category exists for any legacy text value still on deck_has_cards.
INSERT INTO deck_categories (deck_id, name, sort_order)
SELECT DISTINCT
    dhc.deck_id,
    initcap(lower(dhc.category)),
    100
FROM deck_has_cards dhc
WHERE EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'deck_has_cards'
      AND column_name = 'category'
)
AND NOT EXISTS (
    SELECT 1
    FROM deck_categories dc
    WHERE dc.deck_id = dhc.deck_id
      AND lower(dc.name) = lower(dhc.category)
)
ON CONFLICT (deck_id, name) DO NOTHING;

-- Add FK column if missing.
ALTER TABLE deck_has_cards
    ADD COLUMN IF NOT EXISTS category_id BIGINT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'deck_has_cards'
          AND column_name = 'category'
    ) THEN
        UPDATE deck_has_cards dhc
           SET category_id = dc.id
          FROM deck_categories dc
         WHERE dhc.category_id IS NULL
           AND dc.deck_id = dhc.deck_id
           AND lower(dc.name) = lower(dhc.category);
    END IF;
END $$;

-- Backfill any remaining nulls to Main (or first category) for that deck.
UPDATE deck_has_cards dhc
   SET category_id = dc.id
  FROM deck_categories dc
 WHERE dhc.category_id IS NULL
   AND dc.deck_id = dhc.deck_id
   AND dc.name = 'Main';

UPDATE deck_has_cards dhc
   SET category_id = sub.id
  FROM (
      SELECT DISTINCT ON (deck_id) id, deck_id
      FROM deck_categories
      ORDER BY deck_id, sort_order ASC, id ASC
  ) AS sub
 WHERE dhc.category_id IS NULL
   AND sub.deck_id = dhc.deck_id;

ALTER TABLE deck_has_cards
    ALTER COLUMN category_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'deck_has_cards_category_id_fkey'
    ) THEN
        ALTER TABLE deck_has_cards
            ADD CONSTRAINT deck_has_cards_category_id_fkey
            FOREIGN KEY (category_id)
            REFERENCES deck_categories(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- Switch primary key to (deck_id, card_id, category_id).
DO $$
BEGIN
    ALTER TABLE deck_has_cards DROP CONSTRAINT IF EXISTS deck_has_cards_pkey;
    ALTER TABLE deck_has_cards
        ADD CONSTRAINT deck_has_cards_pkey
        PRIMARY KEY (deck_id, card_id, category_id);
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

ALTER TABLE deck_has_cards DROP COLUMN IF EXISTS category;

DROP INDEX IF EXISTS idx_deck_has_cards_deck_category_sort;
CREATE INDEX IF NOT EXISTS idx_deck_has_cards_deck_category_sort
    ON deck_has_cards (deck_id, category_id, sort_order);

COMMENT ON TABLE deck_categories IS 'User-defined (or seeded) card sections per deck.';
COMMENT ON COLUMN deck_has_cards.category_id IS 'FK to deck_categories — Main/Side/custom sections.';
