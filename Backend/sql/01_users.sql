CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    -- User primary data
    user_name TEXT NOT NULL DEFAULT 'unknown',
    password TEXT DEFAULT NULL,
    email TEXT DEFAULT NULL,

    email_verification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_sent_at TIMESTAMPTZ DEFAULT NULL,
    email_verification_received BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ DEFAULT NULL,

    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_code_sent_at TIMESTAMPTZ DEFAULT NULL,
    two_factor_verified_at TIMESTAMPTZ DEFAULT NULL
);