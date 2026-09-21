-- Daily and hourly app-activity counters for the admin analytics page.

CREATE TABLE IF NOT EXISTS analytics_daily (
    day DATE PRIMARY KEY,
    request_count BIGINT NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    login_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytics_hourly (
    hour TIMESTAMPTZ PRIMARY KEY,
    request_count BIGINT NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    login_count INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE analytics_daily IS
    'UTC-day buckets: HTTP requests, first-seen unique users, successful logins.';
COMMENT ON TABLE analytics_hourly IS
    'UTC-hour buckets: HTTP requests, first-seen unique users, successful logins.';
