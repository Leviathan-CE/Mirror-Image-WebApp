-- Auto-create publish_cards rows for new catalogue cards (default: not published).
-- Also backfill any existing cards missing a publish row. Idempotent.

CREATE OR REPLACE FUNCTION cards_ensure_publish_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO publish_cards (card_id, published)
    VALUES (NEW.id, 'not published')
    ON CONFLICT (card_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cards_ensure_publish_row ON cards;
CREATE TRIGGER trg_cards_ensure_publish_row
    AFTER INSERT ON cards
    FOR EACH ROW
    EXECUTE FUNCTION cards_ensure_publish_row();

INSERT INTO publish_cards (card_id, published)
SELECT c.id, 'not published'
FROM cards c
WHERE NOT EXISTS (
    SELECT 1 FROM publish_cards p WHERE p.card_id = c.id
);
