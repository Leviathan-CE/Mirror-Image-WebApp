#!/usr/bin/env bash
# First-time VPS setup (Ubuntu). Run as root or with sudo on a fresh server.
#
# Usage:
#   curl -fsSL ... | bash   # or copy to the VPS and run:
#   sudo bash ./scripts/vps-bootstrap.sh
#
# After this script: clone the repo, copy .env, run scripts/deploy-production.sh

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "→ Updating packages..."
apt-get update
apt-get upgrade -y

echo "→ Installing git, curl, ufw..."
apt-get install -y git curl ca-certificates ufw

echo "→ Configuring firewall (SSH + HTTP + HTTPS)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable docker
systemctl start docker

echo ""
echo "Bootstrap complete."
echo ""
echo "Next steps (as your deploy user):"
echo "  git clone https://github.com/Leviathan-CE/Mirror-Image-WebApp.git"
echo "  cd Mirror-Image-WebApp"
echo "  git checkout getting_production_ready   # or your deploy branch"
echo "  cp .env.production.example .env         # edit secrets + domains"
echo "  bash ./scripts/check-production-env.sh"
echo "  bash ./scripts/deploy-production.sh"
