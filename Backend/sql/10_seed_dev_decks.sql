-- Dev sample decks for the seeded "user" account.
-- Idempotent: skips if those deck names already exist for that user.

DO $$
DECLARE
    v_user_id BIGINT;
    v_deck_id BIGINT;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE lower(email) = 'user@localhost' LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        WHERE uhd.user_id = v_user_id AND d.name = 'Hunter Killer GRP'
    ) THEN
        INSERT INTO decks (name, description)
        VALUES (
            'Hunter Killer GRP',
            'Aggressive midrange list built around Hunter Killer packages.'
        )
        RETURNING id INTO v_deck_id;

        INSERT INTO user_has_decks (user_id, deck_id, is_public)
        VALUES (v_user_id, v_deck_id, TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        WHERE uhd.user_id = v_user_id AND d.name = 'Special Operations BY'
    ) THEN
        INSERT INTO decks (name, description)
        VALUES (
            'Special Operations BY',
            'Control-leaning toolbox with Special Operations support.'
        )
        RETURNING id INTO v_deck_id;

        INSERT INTO user_has_decks (user_id, deck_id, is_public)
        VALUES (v_user_id, v_deck_id, FALSE);
    END IF;
END $$;
