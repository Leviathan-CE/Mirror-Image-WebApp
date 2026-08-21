-- Playtester is always public (no account / no admin grant).
-- Update catalog copy and drop obsolete per-user grants for that key.

UPDATE features
   SET description = 'Public playtester — available without an account; not grantable by admins.'
 WHERE key = 'playtester';

DELETE FROM user_feature_grants g
 USING features f
 WHERE g.feature_id = f.id
   AND f.key = 'playtester';
