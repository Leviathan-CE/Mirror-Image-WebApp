-- In-app inbox: broadcast events + per-user read receipts.
CREATE TABLE IF NOT EXISTS notification_events (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    audience TEXT NOT NULL DEFAULT 'all',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_events_kind_allowed CHECK (
        kind IN (
            'announcement.published',
            'card.created',
            'card.updated',
            'card.removed'
        )
    ),
    CONSTRAINT notification_events_subject_type_allowed CHECK (
        subject_type IN ('announcement', 'card')
    ),
    CONSTRAINT notification_events_audience_allowed CHECK (
        audience IN ('all', 'preview')
    ),
    CONSTRAINT notification_events_title_not_blank CHECK (
        length(trim(title)) > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_notification_events_created
    ON notification_events (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_kind
    ON notification_events (kind);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_announcement_once
    ON notification_events (subject_id)
    WHERE kind = 'announcement.published'
      AND subject_type = 'announcement';

CREATE TABLE IF NOT EXISTS user_notification_reads (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES notification_events (id)
        ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notification_reads_event
    ON user_notification_reads (event_id);

COMMENT ON TABLE notification_events IS
    'Broadcast inbox events. Filter per user by audience, prefs, and reads.';
COMMENT ON TABLE user_notification_reads IS
    'Per-user read receipts for notification_events.';
