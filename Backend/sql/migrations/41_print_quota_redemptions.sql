-- Monthly free print PDF redemptions (subscription tier quotas).

CREATE TABLE IF NOT EXISTS print_quota_redemptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    deck_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_quota_user_month
    ON print_quota_redemptions (user_id, created_at);

COMMENT ON TABLE print_quota_redemptions IS
    'Counts free subscriber print PDF downloads toward monthly tier limits.';
