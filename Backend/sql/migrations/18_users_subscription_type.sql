-- Free-text subscription tier label on users.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_type TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN users.subscription_type IS
    'Human-readable subscription tier label (e.g. standard, premium).';
