CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    -- User primary data
    user_name TEXT NOT NULL,
    password TEXT NOT NULL,  -- bcrypt password hash (never store plaintext)
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',

    -- Stripe subscription entitlement (feature unlocks). Separate from role.
    stripe_customer_id TEXT DEFAULT NULL,
    stripe_subscription_id TEXT DEFAULT NULL,
    subscription_status TEXT NOT NULL DEFAULT 'none',
    subscription_type TEXT NOT NULL DEFAULT '',
    subscription_current_period_end TIMESTAMPTZ DEFAULT NULL,
    subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,

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
    CONSTRAINT users_role_allowed CHECK (role IN ('user', 'admin', 'distributor')),
    CONSTRAINT users_subscription_status_allowed CHECK (
        subscription_status IN (
            'none',
            'active',
            'trialing',
            'past_due',
            'canceled',
            'unpaid',
            'incomplete',
            'incomplete_expired',
            'paused'
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_name_lower
    ON users (lower(user_name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
    ON users (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN users.subscription_status IS
    'Stripe subscription status; feature unlocks when active/trialing (admins always entitled).';
COMMENT ON COLUMN users.subscription_type IS
    'Human-readable subscription tier label (e.g. standard, premium).';
COMMENT ON COLUMN users.subscription_cancel_at_period_end IS
    'True when Stripe will end the subscription at current_period_end (cancel scheduled).';
