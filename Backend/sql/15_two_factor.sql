-- One-time codes for login and for turning 2FA on/off.
-- Fresh installs only (empty volume). Existing volumes: migrations/31_users_two_factor.sql

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
