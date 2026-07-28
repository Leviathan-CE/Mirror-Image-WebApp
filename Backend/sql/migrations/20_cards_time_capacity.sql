-- Add pilot Time resource capacity (TIM), separate from Steel (STL).
-- Historical Unity uploads mapped TIM_capacity → steel_capacity; backfill moves
-- those values into time_capacity so opening stockpile can spawn Natural Time.

ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS time_capacity INTEGER NOT NULL DEFAULT 0;

-- Drop old check, then recreate including time_capacity.
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_capacities_non_negative;

ALTER TABLE cards
    ADD CONSTRAINT cards_capacities_non_negative CHECK (
        ram_capacity >= 0
        AND power_capacity >= 0
        AND metal_capacity >= 0
        AND spirit_capacity >= 0
        AND steel_capacity >= 0
        AND time_capacity >= 0
        AND lif_capacity >= 0
        AND hand_size >= 0
    );

-- One-time data repair: values previously stored as steel were actually TIM.
-- Only runs when time_capacity is still empty so re-applying is safe.
UPDATE cards
SET time_capacity = steel_capacity,
    steel_capacity = 0
WHERE steel_capacity > 0
  AND time_capacity = 0;

COMMENT ON COLUMN cards.time_capacity IS
    'Pilot starting TIM resource tokens (Natural Time). Distinct from steel_capacity (STL).';
