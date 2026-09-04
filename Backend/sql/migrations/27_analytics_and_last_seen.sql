-- Admin analytics: last_seen on users + daily activity buckets.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS analytics_daily (
    day DATE PRIMARY KEY,
    request_count BIGINT NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    login_count INTEGER NOT NULL DEFAULT 0
);

COMMENT ON COLUMN users.last_seen_at IS
    'Last authenticated API request (throttled). Used for “logged in now”.';
COMMENT ON TABLE analytics_daily IS
    'UTC-day buckets: HTTP requests, first-seen unique users, successful logins.';
