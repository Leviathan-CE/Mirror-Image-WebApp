-- Blog mailing list (Coming Soon signups) + unsubscribe tokens.

CREATE TABLE IF NOT EXISTS blog_subscribers (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    unsubscribe_token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    CONSTRAINT blog_subscribers_email_not_blank CHECK (
        length(trim(email)) > 0
    ),
    CONSTRAINT blog_subscribers_email_unique UNIQUE (email),
    CONSTRAINT blog_subscribers_status_allowed CHECK (
        status IN ('active', 'unsubscribed')
    )
);

CREATE INDEX IF NOT EXISTS idx_blog_subscribers_status
    ON blog_subscribers (status);

CREATE INDEX IF NOT EXISTS idx_blog_subscribers_token_hash
    ON blog_subscribers (unsubscribe_token_hash);

COMMENT ON TABLE blog_subscribers IS
    'Public blog mailing list. Unsubscribe token is stored hashed.';
