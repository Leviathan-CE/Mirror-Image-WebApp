#!/usr/bin/env bash
# Dump the Compose Postgres DB to a dated .sql.gz file.
#
# Usage (from repo root, with db running):
#   ./scripts/backup-db.sh
#
# Env overrides (optional):
#   COMPOSE_DB_SERVICE  default: db
#   BACKUP_DIR          default: <repo>/backups/postgres
#   KEEP_DAYS           default: 14
#
# Cron example (daily 03:15, logs to backup.log):
#   15 3 * * * cd /path/to/Mirror-Image-WebApp \
#     && ./scripts/backup-db.sh >> backups/postgres/backup.log 2>&1

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE="${COMPOSE_DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/postgres}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F_%H%M)"
OUT_FILE="${BACKUP_DIR}/mirror_image_${STAMP}.sql.gz"

if ! docker compose ps --status running --services 2>/dev/null \
  | grep -qx "$SERVICE"
then
  echo "error: Compose service '$SERVICE' is not running." >&2
  echo "Start it first: docker compose up -d db" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "→ Dumping database to ${OUT_FILE} ..."
docker compose exec -T "$SERVICE" \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$OUT_FILE"

chmod 600 "$OUT_FILE"

find "$BACKUP_DIR" \
  -type f \
  -name 'mirror_image_*.sql.gz' \
  -mtime "+${KEEP_DAYS}" \
  -delete

echo "✓ Backup OK: ${OUT_FILE}"
echo "  (keeping files newer than ${KEEP_DAYS} days in ${BACKUP_DIR})"
