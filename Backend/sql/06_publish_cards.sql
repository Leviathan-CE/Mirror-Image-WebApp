-- Catalogue card visibility (one status per card — not per user).
CREATE TABLE IF NOT EXISTS publish_cards (
    card_id BIGINT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
    published TEXT NOT NULL DEFAULT 'not published',
    CONSTRAINT publish_cards_published_allowed
        CHECK (published IN ('published', 'preview', 'not published'))
);

COMMENT ON TABLE publish_cards IS 'Publication status for each catalogue card.';
COMMENT ON COLUMN publish_cards.published IS
    'Catalogue visibility: published | preview | not published.';

-- New catalogue cards start unpublished.
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
