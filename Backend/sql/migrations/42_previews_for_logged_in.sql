-- Admin flag: unlock preview-status cards for every logged-in account.

INSERT INTO site_settings (key, value)
VALUES ('previews_for_logged_in', 'false')
ON CONFLICT (key) DO NOTHING;
