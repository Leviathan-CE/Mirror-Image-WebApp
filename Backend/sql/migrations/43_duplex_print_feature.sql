-- Duplex card backs for L2/L3 subscribers (and admin grants).
-- Preview cards are no longer a Stripe entitlement; site flag / grants only.
-- Also backfill subscription-managed grants for existing entitled users.

INSERT INTO features (key, label, description)
SELECT
    'duplex_print',
    'Duplex print',
    'Include mirrored card-back sheets in print-and-play PDFs (Level 2+).'
WHERE NOT EXISTS (
    SELECT 1 FROM features WHERE key = 'duplex_print'
);

UPDATE features
   SET description =
       'Build a print-and-play PDF from a deck on the deck page.'
 WHERE key = 'deck_printout';

-- L1 / any entitled sub: ensure deck_printout grant exists.
INSERT INTO user_feature_grants (user_id, feature_id, granted_by)
SELECT u.id, f.id, NULL
  FROM users u
  JOIN features f ON f.key = 'deck_printout'
 WHERE u.subscription_status IN ('active', 'trialing')
   AND NOT EXISTS (
       SELECT 1
         FROM user_feature_grants g
        WHERE g.user_id = u.id
          AND g.feature_id = f.id
   );

-- L2 / L3: grant duplex_print.
INSERT INTO user_feature_grants (user_id, feature_id, granted_by)
SELECT u.id, f.id, NULL
  FROM users u
  JOIN features f ON f.key = 'duplex_print'
 WHERE u.subscription_status IN ('active', 'trialing')
   AND (
       lower(u.subscription_type) LIKE '%dataminer%'
       OR lower(u.subscription_type) LIKE '%warmachine%'
       OR lower(u.subscription_type) LIKE '%level 2%'
       OR lower(u.subscription_type) LIKE '%level 3%'
       OR lower(u.subscription_type) IN (
           'level2_dataminer',
           'level3_warmachine'
       )
   )
   AND NOT EXISTS (
       SELECT 1
         FROM user_feature_grants g
        WHERE g.user_id = u.id
          AND g.feature_id = f.id
   );

-- L1 (or unlabeled archivist): strip duplex if it was granted by mistake.
DELETE FROM user_feature_grants g
 USING users u, features f
 WHERE g.user_id = u.id
   AND g.feature_id = f.id
   AND f.key = 'duplex_print'
   AND u.subscription_status IN ('active', 'trialing')
   AND (
       lower(u.subscription_type) LIKE '%archivist%'
       OR lower(u.subscription_type) LIKE '%level 1%'
       OR lower(u.subscription_type) = 'level1_archivist'
   );
