-- Auth constraints for an already-created users table (idempotent).

ALTER TABLE users
    ALTER COLUMN user_name SET NOT NULL,
    ALTER COLUMN password DROP DEFAULT,
    ALTER COLUMN email DROP DEFAULT;

-- Allow existing empty rows to be cleaned before NOT NULL if needed.
-- New installs use 01_users.sql; this tightens live DBs safely when possible.

DO $$
BEGIN
    -- Drop placeholder unknown accounts with no credentials before enforcing uniqueness.
    DELETE FROM users
    WHERE (password IS NULL OR password = '')
      AND (email IS NULL OR email = '' OR email = 'unknown')
      AND (user_name IS NULL OR user_name = '' OR user_name = 'unknown');
END $$;

ALTER TABLE users
    ALTER COLUMN password SET NOT NULL,
    ALTER COLUMN email SET NOT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_name_lower
    ON users (lower(user_name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (lower(email));
