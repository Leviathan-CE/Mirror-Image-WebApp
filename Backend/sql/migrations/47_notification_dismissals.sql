-- Per-user inbox hides. Does not delete the broadcast event.
CREATE TABLE IF NOT EXISTS user_notification_dismissals (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES notification_events (id)
        ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notification_dismissals_event
    ON user_notification_dismissals (event_id);

COMMENT ON TABLE user_notification_dismissals IS
    'Per-user inbox hides. The broadcast event stays for everyone else.';
