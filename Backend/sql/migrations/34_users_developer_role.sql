-- Developer role: staff console + card upload, not user management.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_allowed;
ALTER TABLE users
    ADD CONSTRAINT users_role_allowed
    CHECK (role IN ('user', 'admin', 'distributor', 'developer'));
