# Database migrations

Idempotent upgrade scripts for **existing** Postgres volumes that were created
before the current init schema.

Fresh installs should rely on `Backend/sql/*.sql` only (see `../README.md`).
Migrations are for bringing older volumes forward without `down -v`.

## Apply one migration

From the repo root:

```bash
docker compose exec -T db psql -U postgres -d mirror_image < Backend/sql/migrations/13_publish_cards_published.sql
```

## Apply all migrations (in order)

```bash
for f in Backend/sql/migrations/*.sql; do
  echo "Applying $f ..."
  docker compose exec -T db psql -U postgres -d mirror_image < "$f"
done
```
