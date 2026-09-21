-- Unpublished catalogue access — admin grant only (not a Stripe default).
INSERT INTO features (key, label, description)
SELECT
    'unpublished_cards',
    'Unpublished cards',
    'See unpublished catalogue cards and unredacted unpublished deck cards. Admin grant only — not included with Stripe.'
WHERE NOT EXISTS (
    SELECT 1 FROM features WHERE key = 'unpublished_cards'
);
