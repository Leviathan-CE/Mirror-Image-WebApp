-- Shared login and mail limits. One row per purpose and account key.
-- Every API process reads the same counter.

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    purpose TEXT NOT NULL,
    key TEXT NOT NULL,
    window_started TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL,
    PRIMARY KEY (purpose, key)
);
