#!/usr/bin/env bash
# Apply all Backend/sql/migrations/*.sql to the running Docker Compose Postgres.
# Safe to re-run: migrations are written to be idempotent (IF NOT EXISTS, etc.).
#
# Usage (from repo root):
#   ./scripts/migrate-db.sh
#   ./scripts/migrate-db.sh 17_users_stripe_subscription.sql   # one file
#
# Env overrides (optional):
#   COMPOSE_FILE        default: docker-compose.yml (set to docker-compose.yml:docker-compose.prod.yml in prod)
#   COMPOSE_DB_SERVICE  default: db
#   POSTGRES_USER       default: postgres
#   POSTGRES_DB         default: mirror_image

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE="${COMPOSE_DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-mirror_image}"
MIGRATIONS_DIR="Backend/sql/migrations"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx "$SERVICE"; then
  echo "error: Compose service '$SERVICE' is not running." >&2
  echo "Start the stack first: docker compose up -d db" >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "error: migrations folder not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

apply_one() {
  local file="$1"
  local name
  name="$(basename "$file")"
  echo "→ Applying $name ..."
  docker compose exec -T "$SERVICE" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$file"
}

if [[ "${1:-}" != "" ]]; then
  TARGET="$1"
  if [[ "$TARGET" != /* && "$TARGET" != Backend/* && "$TARGET" != ./* ]]; then
    TARGET="$MIGRATIONS_DIR/$TARGET"
  fi
  if [[ ! -f "$TARGET" ]]; then
    echo "error: migration file not found: $TARGET" >&2
    exit 1
  fi
  apply_one "$TARGET"
else
  shopt -s nullglob
  files=("$MIGRATIONS_DIR"/*.sql)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No .sql files in $MIGRATIONS_DIR"
    exit 0
  fi
  for f in "${files[@]}"; do
    apply_one "$f"
  done
fi

echo "✓ Migrations complete."
