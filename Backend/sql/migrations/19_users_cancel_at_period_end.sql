-- Track Stripe cancel-at-period-end so UI can show "Period end" while status is still active.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.subscription_cancel_at_period_end IS
    'True when Stripe will end the subscription at current_period_end (cancel scheduled).';
