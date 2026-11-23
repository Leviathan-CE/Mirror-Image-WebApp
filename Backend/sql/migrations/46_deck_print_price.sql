-- Per-deck print price. NULL uses the standard card-count price.
-- 0 prints free. A positive value is a custom price in US cents.

ALTER TABLE decks
    ADD COLUMN IF NOT EXISTS print_price_cents INTEGER;

ALTER TABLE decks
    DROP CONSTRAINT IF EXISTS decks_print_price_cents_range;

ALTER TABLE decks
    ADD CONSTRAINT decks_print_price_cents_range
    CHECK (
        print_price_cents IS NULL
        OR (
            print_price_cents = 0
            OR (
                print_price_cents >= 50
                AND print_price_cents <= 100000
            )
        )
    );

COMMENT ON COLUMN decks.print_price_cents IS
    'NULL = standard print price, 0 = free, else custom cents.';
