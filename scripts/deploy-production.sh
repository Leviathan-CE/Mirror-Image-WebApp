#!/usr/bin/env bash
# Build and start the production Docker stack (app + nginx).
# Run from repo root after .env is configured.
#
# Usage:
#   bash ./scripts/deploy-production.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml"
COMPOSE=(docker compose)

if [[ ! -f .env ]]; then
  echo "error: missing .env — copy .env.production.example and edit it." >&2
  exit 1
fi

bash ./scripts/check-production-env.sh

# shellcheck disable=SC1091
set -a
source .env
set +a

echo "→ Building and starting production stack..."
"${COMPOSE[@]}" up -d --build

echo "→ Waiting for database..."
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx db; then
    if "${COMPOSE[@]}" exec -T db pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-mirror_image}" >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 2
done

echo "→ Applying database migrations..."
bash ./scripts/migrate-db.sh

echo ""
echo "Production stack is up."
echo "  Site: https://${SITE_DOMAIN}"
echo "  API:  https://${API_DOMAIN}"
echo ""
echo "Check logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
