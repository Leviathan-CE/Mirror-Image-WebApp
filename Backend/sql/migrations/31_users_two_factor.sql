-- 2FA method + phone + challenge codes (existing volumes).
-- Fresh installs: 01_users.sql + 15_two_factor.sql

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_method TEXT DEFAULT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_code_sent_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_e164 TEXT DEFAULT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'users_two_factor_method_allowed'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_two_factor_method_allowed CHECK (
                two_factor_method IS NULL
                OR two_factor_method IN ('email', 'sms')
            );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS two_factor_challenges (
    id TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    method TEXT NOT NULL,
    dest_hint TEXT NOT NULL DEFAULT '',
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT two_factor_challenges_purpose_allowed CHECK (
        purpose IN ('login', 'enable', 'disable')
    ),
    CONSTRAINT two_factor_challenges_method_allowed CHECK (
        method IN ('email', 'sms')
    )
);

CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_purpose
    ON two_factor_challenges (user_id, purpose)
    WHERE used_at IS NULL;
