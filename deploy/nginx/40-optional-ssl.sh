#!/bin/sh
# Append HTTPS vhosts when Cloudflare origin certs are present on the VPS.
set -eu

SSL_DIR="/etc/nginx/ssl"
TEMPLATE="/etc/nginx/ssl.conf.template"
OUT="/etc/nginx/conf.d/ssl.conf"

if [ -f "$SSL_DIR/origin.pem" ] && [ -f "$SSL_DIR/origin.key" ]; then
  echo "nginx: enabling HTTPS (origin.pem found)"
  envsubst '${SITE_DOMAIN} ${API_DOMAIN}' < "$TEMPLATE" > "$OUT"
else
  echo "nginx: HTTP only on :80 (drop origin.pem + origin.key into deploy/nginx/ssl/ for HTTPS)"
  rm -f "$OUT"
fi
