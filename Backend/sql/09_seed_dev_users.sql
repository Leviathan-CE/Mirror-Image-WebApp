-- Dev-only seed accounts for local testing.
-- Runs on first DB init (empty volume). Safe to re-run (idempotent).
--
--   admin@localhost  / admin123   → role admin
--   store@localhost  / store123   → role distributor
--   user@localhost   / user123    → role user
--
-- Seed accounts are email-verified so local login works without SMTP.
-- Do NOT use these passwords in production.

INSERT INTO users (
    user_name,
    email,
    password,
    role,
    is_active,
    email_verification_sent,
    email_verification_received,
    email_verified_at
)
SELECT
    'admin',
    'admin@localhost',
    '$2b$12$wvLPlK2HuKxCBFITEl/KbO.Scr543iDjETFgr7GzLLuISeyNmjS7i',
    'admin',
    TRUE,
    TRUE,
    TRUE,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE lower(email) = 'admin@localhost'
);

INSERT INTO users (
    user_name,
    email,
    password,
    role,
    is_active,
    email_verification_sent,
    email_verification_received,
    email_verified_at
)
SELECT
    'distributor',
    'store@localhost',
    '$2b$12$8H6imr2tcAWRa55vcFbPCe0FyJ5l/XcnLNVfF9jOhf.q0T7CK.A7m',
    'distributor',
    TRUE,
    TRUE,
    TRUE,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE lower(email) = 'store@localhost'
);

INSERT INTO users (
    user_name,
    email,
    password,
    role,
    is_active,
    email_verification_sent,
    email_verification_received,
    email_verified_at
)
SELECT
    'user',
    'user@localhost',
    '$2b$12$1Op78lbFAYXl3JcDr4uJSOFNg16BUYHP21sGmQX2qlZ7Ciu182zf6',
    'user',
    TRUE,
    TRUE,
    TRUE,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE lower(email) = 'user@localhost'
);

-- Older seed rows (pre-verification): keep local login working.
UPDATE users
   SET email_verification_sent = TRUE,
       email_verification_received = TRUE,
       email_verified_at = COALESCE(email_verified_at, NOW()),
       is_active = TRUE
 WHERE lower(email) IN ('admin@localhost', 'store@localhost', 'user@localhost');
