-- Soft-disable + feature grants + email tokens (existing volumes).
-- Idempotent. Fresh installs also get these via 01_users.sql + 11_features_grants_email.sql.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.is_active IS
    'False blocks login (soft-disable). Decks and data are retained.';

-- Existing accounts stay usable after this migration (verification enforced for new signups).
UPDATE users
   SET email_verification_received = TRUE,
       email_verified_at = COALESCE(email_verified_at, NOW())
 WHERE email_verification_received = FALSE;

CREATE TABLE IF NOT EXISTS features (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT features_key_not_blank CHECK (length(trim(key)) > 0),
    CONSTRAINT features_label_not_blank CHECK (length(trim(label)) > 0)
);

CREATE TABLE IF NOT EXISTS user_feature_grants (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    feature_id BIGINT NOT NULL REFERENCES features (id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_user_feature_grants_feature_id
    ON user_feature_grants (feature_id);

CREATE TABLE IF NOT EXISTS email_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_tokens_purpose_allowed CHECK (
        purpose IN ('verify_email', 'password_reset', 'invite')
    )
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_user_purpose
    ON email_tokens (user_id, purpose);

INSERT INTO features (key, label, description)
SELECT
    'preview_cards',
    'Preview cards',
    'See preview-status catalogue cards and unredacted preview deck cards.'
WHERE NOT EXISTS (
    SELECT 1 FROM features WHERE key = 'preview_cards'
);

INSERT INTO features (key, label, description)
SELECT
    'playtester',
    'Playtester',
    'Public playtester — available without an account; not grantable by admins.'
WHERE NOT EXISTS (
    SELECT 1 FROM features WHERE key = 'playtester'
);
