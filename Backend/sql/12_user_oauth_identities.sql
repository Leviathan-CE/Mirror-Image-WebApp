-- OAuth provider identities (Google first; Apple later).
-- One row per (provider, subject). A user may have multiple providers.

CREATE TABLE IF NOT EXISTS user_oauth_identities (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    email_at_link TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_oauth_provider_allowed CHECK (
        provider IN ('google', 'apple')
    ),
    CONSTRAINT user_oauth_subject_not_blank CHECK (length(trim(subject)) > 0),
    CONSTRAINT user_oauth_provider_subject_unique UNIQUE (provider, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user_id
    ON user_oauth_identities (user_id);

COMMENT ON TABLE user_oauth_identities IS
    'Stable provider subject → user. Do not treat email alone as proof of ownership.';
