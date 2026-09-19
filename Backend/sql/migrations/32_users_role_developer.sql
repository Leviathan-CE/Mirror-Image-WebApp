-- Allow role = developer (card upload / catalogue tools; not full admin).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_allowed;

ALTER TABLE users
    ADD CONSTRAINT users_role_allowed
    CHECK (role IN ('user', 'admin', 'distributor', 'developer'));
