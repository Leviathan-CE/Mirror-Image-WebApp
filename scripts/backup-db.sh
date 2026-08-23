#!/usr/bin/env bash
# Dump Postgres to ./backups/ (create before first deploy or script creates it).
#
# Usage:
#   bash ./scripts/backup-db.sh
#   COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml bash ./scripts/backup-db.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE="${COMPOSE_DB_SERVICE:-db}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-mirror_image}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${1:-$BACKUP_DIR/mirror_image-$STAMP.sql}"

mkdir -p "$BACKUP_DIR"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx "$SERVICE"; then
  echo "error: Compose service '$SERVICE' is not running." >&2
  exit 1
fi

echo "→ Writing $OUT ..."
docker compose exec -T "$SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  >"$OUT"

echo "Done. ($(wc -c <"$OUT" | tr -d ' ') bytes)"
