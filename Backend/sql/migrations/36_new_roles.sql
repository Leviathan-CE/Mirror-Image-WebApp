-- New roles added here:  role:regular user+ignore coming soon page.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_allowed;
ALTER TABLE users
    ADD CONSTRAINT users_role_allowed
    CHECK (role IN ('user', 'admin', 'distributor', 'developer','play_tester'));
