-- Add role column for existing databases (idempotent).
-- Values: user (player), admin (dev), distributor (store)

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_allowed'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_allowed
            CHECK (role IN ('user', 'admin', 'distributor'));
    END IF;
END $$;
