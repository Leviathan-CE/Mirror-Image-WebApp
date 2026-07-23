# Database init (source of truth for new environments)

Scripts in this folder are mounted into Postgres
`docker-entrypoint-initdb.d` and run **once** on an empty volume.

They define the full current schema. New deploys do not need migrations.

| Order | File | Purpose |
|------:|------|---------|
| 01 | `01_users.sql` | Users + roles + auth indexes |
| 02 | `02_decks.sql` | Decks + cover art columns |
| 03 | `03_cards.sql` | Card catalogue |
| 04 | `04_user_has_decks.sql` | User ↔ deck ownership |
| 04b | `04b_deck_categories.sql` | Per-deck sections |
| 05 | `05_deck_has_cards.sql` | Deck card entries |
| 06 | `06_publish_cards.sql` | Card publish status |
| 09 | `09_seed_dev_users.sql` | Dev accounts (local only) |
| 10 | `10_seed_dev_decks.sql` | Dev sample decks (local only) |

Default deck section names (`Main`, `Side`, `Maybe`, `Extra`) are seeded by
the API when a deck is created (`app/deck_defaults.py`), not by SQL.

### Existing volumes

Use `migrations/` to upgrade older DBs without wiping data. See
`migrations/README.md`.
