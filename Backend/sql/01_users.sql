CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    -- User primary data
    user_name TEXT NOT NULL,
    password TEXT NOT NULL,  -- bcrypt password hash (never store plaintext)
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    
    email_verification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_sent_at TIMESTAMPTZ DEFAULT NULL,
    email_verification_received BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ DEFAULT NULL,

    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_code_sent_at TIMESTAMPTZ DEFAULT NULL,
    two_factor_verified_at TIMESTAMPTZ DEFAULT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_user_name_not_blank CHECK (length(trim(user_name)) > 0),
    CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT users_password_not_blank CHECK (length(password) > 0),
    CONSTRAINT users_role_allowed CHECK (role IN ('user', 'admin', 'distributor'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_name_lower
    ON users (lower(user_name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (lower(email));
