-- Account UI preferences (decks + card library), JSON object on the user row.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.preferences IS
    'Allowlisted UI prefs: deck view/sort/browse width, library sort/page size/preview px.';
