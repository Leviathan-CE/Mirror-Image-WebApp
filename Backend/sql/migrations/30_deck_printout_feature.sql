-- Deck printout PDF — subscriber default (admins always have all features).
INSERT INTO features (key, label, description)
SELECT
    'deck_printout',
    'Deck printout',
    'Build a duplex print-and-play PDF from a deck on the deck page.'
WHERE NOT EXISTS (
    SELECT 1 FROM features WHERE key = 'deck_printout'
);
