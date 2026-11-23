#!/usr/bin/env bash
# Run the backend pytest suite and the frontend vitest suite.
#
# Usage (from repo root):
#   ./scripts/test.sh
#   npm test

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

backend_status=0
frontend_status=0

echo "→ Backend tests"
if ! (
  cd Backend
  python -m pytest -q
); then
  backend_status=1
fi

echo "→ Frontend tests"
if ! (
  cd Frontend
  npm run test:run
); then
  frontend_status=1
fi

if [[ "$backend_status" -ne 0 ]]; then
  echo "error: backend tests failed" >&2
fi

if [[ "$frontend_status" -ne 0 ]]; then
  echo "error: frontend tests failed" >&2
fi

if [[ "$backend_status" -ne 0 || "$frontend_status" -ne 0 ]]; then
  exit 1
fi

echo "→ Backend and frontend tests passed"
