-- Feature catalog, per-user grants, and email auth tokens (fresh DB init).

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
    'Reserved unlock for playtester access (gate when paywalled).'
WHERE NOT EXISTS (
    SELECT 1 FROM features WHERE key = 'playtester'
);
