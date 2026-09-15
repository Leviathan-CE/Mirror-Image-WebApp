-- Whether a card's invoke cost should be shown in UI (list / detail).
-- Stored separately from invoke_cost / cost so "0" or empty pips can still mean
-- "this card has an invoke cost line" when the flag is true.

ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS has_invoke_cost BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN cards.has_invoke_cost IS
    'When true, frontends may show invoke cost (icons/number); when false, leave blank.';

-- Existing catalogue: treat cards that already have cost data as "has invoke cost"
-- so current UI does not go blank until Unity re-syncs the flag.
UPDATE cards
   SET has_invoke_cost = TRUE
 WHERE has_invoke_cost = FALSE
   AND (
        invoke_cost > 0
        OR jsonb_array_length(COALESCE(cost, '[]'::jsonb)) > 0
   );
