-- Hourly app-activity buckets for the admin analytics chart.
CREATE TABLE IF NOT EXISTS analytics_hourly (
    hour TIMESTAMPTZ PRIMARY KEY,
    request_count BIGINT NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    login_count INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE analytics_hourly IS
    'UTC-hour buckets: HTTP requests, first-seen unique users, successful logins.';
