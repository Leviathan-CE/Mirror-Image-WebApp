-- Auth constraints for an already-created users table (idempotent).
-- Safe to re-run after Google OAuth (nullable passwords).

ALTER TABLE users
    ALTER COLUMN user_name SET NOT NULL,
    ALTER COLUMN password DROP DEFAULT,
    ALTER COLUMN email DROP DEFAULT;

-- Drop placeholder unknown accounts with no credentials before uniqueness.
DO $$
BEGIN
    DELETE FROM users
    WHERE (password IS NULL OR password = '')
      AND (email IS NULL OR email = '' OR email = 'unknown')
      AND (user_name IS NULL OR user_name = '' OR user_name = 'unknown');
END $$;

ALTER TABLE users
    ALTER COLUMN email SET NOT NULL;

-- Password may be NULL for OAuth-only accounts (Google / Apple).
-- Never SET NOT NULL here — that breaks re-running migrate after 23_users_oauth_google.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_not_blank;
ALTER TABLE users
    ALTER COLUMN password DROP NOT NULL;
ALTER TABLE users
    ADD CONSTRAINT users_password_not_blank CHECK (
        password IS NULL OR length(trim(password)) > 0
    );

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_name_lower
    ON users (lower(user_name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (lower(email));
