-- One-time paid print download grants (non-subscribers).

CREATE TABLE IF NOT EXISTS print_download_grants (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    deck_id BIGINT NOT NULL,
    payment_intent_id TEXT NOT NULL,
    card_count INT NOT NULL,
    amount_cents INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    CONSTRAINT print_download_grants_pi_unique UNIQUE (payment_intent_id),
    CONSTRAINT print_download_grants_counts_ok CHECK (
        card_count >= 0 AND amount_cents >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_print_grants_user_deck
    ON print_download_grants (user_id, deck_id);

CREATE INDEX IF NOT EXISTS idx_print_grants_expires
    ON print_download_grants (expires_at);

COMMENT ON TABLE print_download_grants IS
    'Short-lived paid unlocks for deck print PDFs (non-subscribers).';
