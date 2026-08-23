# Deploy assets

| File | Purpose |
| --- | --- |
| `nginx/default.conf.template` | HTTP reverse proxy — site + API subdomains |
| `nginx/ssl.conf.template` | Optional HTTPS (Cloudflare origin cert) |
| `nginx/ssl/` | Drop `origin.pem` + `origin.key` here (gitignored) |
| `../docker-compose.prod.yml` | Production overrides (nginx, no public DB port) |
| `../scripts/vps-bootstrap.sh` | First-time Ubuntu VPS setup (Docker, firewall) |
| `../scripts/deploy-production.sh` | Build stack, run migrations |
| `../scripts/check-production-env.sh` | Validate `.env` before deploy |
| `../scripts/backup-db.sh` | Postgres dump to `../backups/` |
| `../.env.production.example` | Production `.env` template |

See **`DEPLOY.md`** at the repo root for the full walkthrough (including **Production legal + ops checklist** for OVH-style VPS hosting). Privacy law and **DB encryption plan**: **[`PRIVACY_AND_DATA_PROTECTION.md`](../PRIVACY_AND_DATA_PROTECTION.md)**.
