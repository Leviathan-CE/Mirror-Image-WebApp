-- Whether a deck section counts as the playable RIG (true) or is list-only.

ALTER TABLE deck_categories
    ADD COLUMN IF NOT EXISTS in_deck BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN deck_categories.in_deck IS
    'When false, the section is a list only and is not part of the RIG.';

-- Historical Side / Maybe / Extra piles, plus reserved slots, stay out of the RIG.
UPDATE deck_categories
   SET in_deck = FALSE
 WHERE lower(btrim(name)) IN ('side', 'maybe', 'extra', 'pilot', 'augments');
