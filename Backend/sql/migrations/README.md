# Database migrations

Patches for **existing** Postgres volumes that were created before the
current init schema in `Backend/sql/*.sql`.

Fresh installs do not need this folder. Postgres runs the init scripts
once on an empty volume; that is the baseline.

Historical stepping-stones (`07`–`31`) were removed after every live
volume already matched that baseline. Replaying them was unsafe: `11`
tried to rebuild an obsolete `deck_has_cards` primary key.

## Apply all remaining patches

From the repo root, with `db` running:

```bash
npm run migrate
```

Or:

```bash
./scripts/migrate-db.sh
```

## Apply one file

```bash
npm run migrate -- 32_unpublished_cards_feature.sql
```

## Current patches

| File | Purpose |
|------|---------|
| `32_unpublished_cards_feature.sql` | Admin-grantable unpublished catalogue access |

New schema that is not yet in init belongs here as `33_…`, `34_…`, and
must also be copied into the matching init file so empty volumes stay
current.
