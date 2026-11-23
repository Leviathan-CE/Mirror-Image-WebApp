-- Types a deck section claims. Empty means the section does not auto-file.

ALTER TABLE deck_categories
    ADD COLUMN IF NOT EXISTS accept_types TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN deck_categories.accept_types IS
    'Types this section claims. A card is filed here when it has every type. The set must be unique on the deck. Empty means no auto-file.';
