-- Site-wide flags (admin console). One row per key.

CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_settings (key, value)
VALUES ('coming_soon', 'false')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE site_settings IS
    'Admin-toggled site flags. coming_soon hides the public app behind a splash.';
