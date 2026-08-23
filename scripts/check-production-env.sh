#!/usr/bin/env bash
# Fail fast if .env still has dev defaults before a production deploy.
#
# Usage:
#   bash ./scripts/check-production-env.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "error: .env not found" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

fail=0

warn() {
  echo "WARN: $*" >&2
}

err() {
  echo "ERROR: $*" >&2
  fail=1
}

[[ "${APP_ENV:-development}" == "production" ]] || err "APP_ENV must be production"

[[ -n "${SITE_DOMAIN:-}" ]] || err "SITE_DOMAIN is required (e.g. mirrorimagetcg.net)"
[[ -n "${API_DOMAIN:-}" ]] || err "API_DOMAIN is required (e.g. api.mirrorimagetcg.net)"
[[ -n "${VITE_API_URL:-}" ]] || err "VITE_API_URL is required (must match public API URL)"
[[ -n "${FRONTEND_URL:-}" ]] || err "FRONTEND_URL is required"

if [[ "${POSTGRES_PASSWORD:-postgres}" == "postgres" ]]; then
  err "POSTGRES_PASSWORD must not be the default 'postgres'"
fi

if [[ "${JWT_SECRET:-}" == *"dev-only"* ]] || [[ -z "${JWT_SECRET:-}" ]] || [[ ${#JWT_SECRET} -lt 32 ]]; then
  err "JWT_SECRET must be a long random string (32+ chars, not dev default)"
fi

if [[ "${VITE_API_URL:-}" != https://* ]]; then
  warn "VITE_API_URL should use https:// in production"
fi

if [[ "${FRONTEND_URL:-}" != https://* ]]; then
  warn "FRONTEND_URL should use https:// in production"
fi

expected_api="https://${API_DOMAIN}"
if [[ "${VITE_API_URL%/}" != "${expected_api}" ]]; then
  warn "VITE_API_URL (${VITE_API_URL}) should match https://${API_DOMAIN}"
fi

if [[ -z "${GOOGLE_CLIENT_ID:-}" ]]; then
  warn "GOOGLE_CLIENT_ID is empty — Google sign-in will not work"
fi

if [[ -z "${SMTP_HOST:-}" || -z "${MAIL_FROM:-}" ]]; then
  warn "SMTP_HOST / MAIL_FROM empty — verify/reset email will not send"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "" >&2
  echo "Fix .env (see .env.production.example) and re-run." >&2
  exit 1
fi

echo "Production .env checks passed."
