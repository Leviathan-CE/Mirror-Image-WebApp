-- Stripe subscription fields on users (feature unlock entitlement).
-- Idempotent for existing volumes.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT DEFAULT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_subscription_status_allowed'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_subscription_status_allowed
            CHECK (
                subscription_status IN (
                    'none',
                    'active',
                    'trialing',
                    'past_due',
                    'canceled',
                    'unpaid',
                    'incomplete',
                    'incomplete_expired',
                    'paused'
                )
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
    ON users (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN users.subscription_status IS
    'Stripe subscription status; feature unlocks when active/trialing (admins always entitled).';
