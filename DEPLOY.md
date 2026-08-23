# Deploying Mirror Image (production)

This app is **not** a static site. Cloudflare (domain + email) is only the front door.
You still need somewhere that runs your three Docker services:

1. **frontend** — React/Vite build served by nginx  
2. **api** — FastAPI (Python) on port 8000  
3. **db** — PostgreSQL 16  

Locally: `docker compose up --build` from the repo root.

Production: **`docker compose -f docker-compose.yml -f docker-compose.prod.yml`** plus **nginx** on 80/443.

---

## Quick start (Canada VPS)

This branch (`getting_production_ready`) includes scripts and compose overrides so you can ship without hand-wiring nginx.

### 1. Rent a VPS (Canada)

| Provider | Region |
| --- | --- |
| OVHcloud | Beauharnois (QC), Toronto |
| Vultr | Toronto |
| DigitalOcean | Toronto |
| Akamai/Linode | Toronto |

**Spec:** Ubuntu 24.04, **2 GB RAM** minimum (4 GB nicer), SSH key login.

### 2. Bootstrap the server (once)

SSH in as root:

```bash
git clone https://github.com/Leviathan-CE/Mirror-Image-WebApp.git
cd Mirror-Image-WebApp
git checkout getting_production_ready
sudo bash ./scripts/vps-bootstrap.sh
```

Installs Docker, opens **22 / 80 / 443** only.

### 3. Configure `.env`

As your deploy user:

```bash
cp .env.production.example .env
nano .env
```

Set at least:

| Variable | Example |
| --- | --- |
| `SITE_DOMAIN` | `mirrorimagetcg.net` |
| `API_DOMAIN` | `api.mirrorimagetcg.net` |
| `VITE_API_URL` | `https://api.mirrorimagetcg.net` |
| `FRONTEND_URL` | `https://mirrorimagetcg.net` |
| `FRONTEND_ORIGINS` | `https://mirrorimagetcg.net,https://www.mirrorimagetcg.net` |
| `POSTGRES_PASSWORD` | long random |
| `JWT_SECRET` | long random (32+ chars) |
| `APP_ENV` | `production` |

Validate:

```bash
bash ./scripts/check-production-env.sh
```

### 4. Cloudflare DNS

Point both hostnames at the VPS IP (orange cloud / proxied is fine):

| Type | Name | Content |
| --- | --- | --- |
| A | `@` | VPS IP |
| A | `www` | VPS IP |
| A | `api` | VPS IP |

**SSL/TLS → Overview:** for the fastest first deploy use **Flexible** (Cloudflare HTTPS → nginx HTTP on port 80). When you want **Full (strict)**, add a Cloudflare Origin Certificate — see `deploy/nginx/ssl/README.md`.

### 5. Deploy

```bash
bash ./scripts/deploy-production.sh
# or: npm run deploy
```

This builds all images, starts **db + api + frontend + nginx**, and runs DB migrations.

### 6. External services

| Service | What to configure |
| --- | --- |
| **Google OAuth** | Authorized JS origins = `FRONTEND_URL` (+ `www` if used) |
| **Stripe webhook** | `https://api.YOUR_DOMAIN/billing/webhook` |
| **SMTP** | Resend, Postmark, SES, etc. — Cloudflare Email Routing does **not** send app mail |

### 7. Backups

```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml bash ./scripts/backup-db.sh
# or: npm run deploy:backup   (export COMPOSE_FILE in your shell profile on the VPS)
```

Also back up the Docker volume **`api_thumbnails`** (card art) before you care about data loss.

**Automate (example — daily DB dump, keep 14 days):**

```bash
# crontab -e  (on the VPS, as your deploy user)
0 3 * * * cd /path/to/Mirror-Image-WebApp && COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml bash ./scripts/backup-db.sh && find backups -name '*.sql' -mtime +14 -delete
```

Store copies **off the VPS** (object storage, another provider, encrypted drive). Hosts like OVH do not restore your app data for you.

---

## Production legal + ops checklist (VPS)

**Not legal advice.** Practical items when hosting on **OVHcloud Canada** (or any “you manage the box” VPS). Read the host’s **General Terms** + **VPS Specific Conditions** yourself.

### Backups — your responsibility

| What | Action |
| --- | --- |
| Postgres | Scheduled `backup-db.sh` + copies **off-server** |
| Card thumbnails | Docker volume `api_thumbnails` — export periodically (`docker run … volume`) |
| Before cancel/upgrade | Recover or migrate **before** the VPS is destroyed |
| Test restores | A backup you’ve never restored is a hope, not a plan |

Host SLAs usually cover **machine uptime**, not **your database contents**. Treat the VPS as disposable; treat backups as the source of truth.

### Email — use a provider, not the VPS

- Configure **`SMTP_*`** in `.env` (Resend, Postmark, Amazon SES, etc.).
- **Do not** run your own outbound mail server on the VPS.
- OVH monitors **port 25**; spam/abuse can get SMTP **blocked permanently** on that server.
- Cloudflare **Email Routing** receives/forwards mail — it does **not** send verify/reset mail for the app.

### Your site’s legal pages (Mirror Image)

You store accounts, emails, deck names/descriptions, and public community decks. Plan for:

- [ ] **Terms of Use** — rules for accounts, public decks, billing, acceptable behaviour  
- [ ] **Privacy Policy** — what you collect (email, Google sign-in, Stripe), why, retention, contact  
- [ ] **Acceptable use** — aligned with your profanity filters; how to report abuse  
- [ ] Links in footer or signup flow (before paid features go live)

Host terms make **you** responsible for **Content** on the server (lawful use, third-party rights). Your player-facing terms should match what you actually enforce.

### User-generated content

- Public deck names/descriptions are **your users’ content** on **your infrastructure**.
- Keep profanity/abuse tooling (`PUBLIC_TEXT_*` filters) and a contact path for takedowns.
- Serious or repeated abuse can lead to host **suspension** (often with little notice) — document your own moderation steps.

### VPS billing & renewals (OVHcloud)

- **Auto-renew** is usually on — disable in the Control Panel before renewal if you’re experimenting.
- OVH renewal cutoffs often reference the **19th** (Paris time) — check your order confirmation.
- **Late payment** (~4 days) can mean **full service suspension**, not just the VPS.
- **Commitment periods** — you may owe the term even if you stop using the server.
- Keep a valid payment method; download invoices from the Control Panel.

### Security & ops (you are the sysadmin)

- [ ] Firewall: **22 / 80 / 443** only (`vps-bootstrap.sh`)  
- [ ] Postgres **not** public (prod compose)  
- [ ] Strong `JWT_SECRET`, `POSTGRES_PASSWORD`; rotate if leaked  
- [ ] OS/Docker image updates on a schedule  
- [ ] No casual penetration testing against OVH shared infrastructure — follow host rules if you audit **your** VPS  

Anti-DDoS from the host is **partial**. Cloudflare in front helps; still plan for downtime.

### Personal data (Canada)

- You likely handle personal info (email, username, OAuth ids) — **PIPEDA** / Quebec **Law 25** may apply for Canadian users.
- OVH’s **Personal Information Protection Agreement** covers their role; **you** remain accountable to players.
- Document: what you store, why, how long, how users request deletion/export (even if manual at first).

Full detail: **[`PRIVACY_AND_DATA_PROTECTION.md`](PRIVACY_AND_DATA_PROTECTION.md)**.

### Third-party contracts (in addition to OVH)

| Service | You must comply with |
| --- | --- |
| **Stripe** | Merchant terms, test → live cutover, webhook security |
| **Google OAuth** | Branding, authorized domains, privacy disclosure |
| **SMTP provider** | Sending policy, bounce handling |
| **Cloudflare** | ToS, SSL mode choice (Flexible vs Full strict) |

### Before you cancel the VPS

1. Final **DB + thumbnail** backup  
2. Export anything from `.env` you’ll need elsewhere (secrets, Stripe ids)  
3. Update **DNS** so traffic doesn’t point at a dead IP  
4. Cancel **Stripe webhook** / Google origins if the domain goes idle  

After termination, host data deletion is typically **automatic and irreversible**.

---

## Architecture

```
Browser
  → Cloudflare (DNS + HTTPS)
    → VPS :443 / :80 (nginx — deploy/nginx/)
      → frontend:80
      → api:8000
      → db:5432 (Docker network only — not on public internet)
```

**Why two hostnames?** FastAPI routes live at `/auth`, `/decks`, `/billing`, etc. (no `/api` prefix). The frontend calls a separate **`API_DOMAIN`** via `VITE_API_URL`.

---

## Compose files

| File | Use |
| --- | --- |
| `docker-compose.yml` | Local dev (ports 3000, 8000, 5433) |
| `docker-compose.prod.yml` | Production overrides + nginx |

Local dev (unchanged):

```bash
cp .env.example .env
docker compose up --build
```

Production:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

After changing `VITE_API_URL`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

---

## What Cloudflare does vs what it does not

| You already have | What it actually does |
| --- | --- |
| Domain on Cloudflare | DNS names → VPS IP |
| Cloudflare Email Routing | **Receive** mail to your domain (forward) |
| Cloudflare proxy (orange cloud) | HTTPS, DDoS, CDN in front of the VPS |

| Cloudflare does **not** replace | Why |
| --- | --- |
| Running FastAPI | Needs a long-lived Python process |
| Running Postgres | Needs a database server |
| Sending transactional email | Use SMTP provider for verify/reset |

---

## Production env checklist

Copy from `.env.production.example` and change every secret.

- [ ] `APP_ENV=production`
- [ ] Strong `POSTGRES_PASSWORD`, `JWT_SECRET`
- [ ] `SITE_DOMAIN`, `API_DOMAIN`, `VITE_API_URL`, `FRONTEND_*` match live HTTPS URLs
- [ ] Postgres **not** exposed publicly (prod compose removes `db` ports)
- [ ] nginx serving 80 (and 443 if using origin certs)
- [ ] Stripe webhook + Google origins updated for live domain
- [ ] Outbound SMTP works for verify/reset
- [ ] Backup plan for DB + thumbnails (+ off-server copies)
- [ ] Site Terms, Privacy Policy, abuse/reporting path
- [ ] VPS auto-renew / billing understood (see checklist below)

See **Production legal + ops checklist (VPS)** below and **[`PRIVACY_AND_DATA_PROTECTION.md`](PRIVACY_AND_DATA_PROTECTION.md)** (Law 25, PIPEDA, breach-minded DB encryption plan).

---

## Branch to deploy

Use **`getting_production_ready`** (this branch) or **`main`** after merging it.

---

## Other hosting options

### PaaS (Railway, Render, Fly.io)

Split managed Postgres + API container + frontend container. More wiring than one VPS compose stack.

### Cloudflare-only (Pages / Workers)

**Not enough alone** — you still need FastAPI + Postgres + thumbnail storage somewhere.

---

## What “ready” means

Ready to host when the checklists above pass and smoke tests work on the live domain (login, decks, billing in Stripe **test** mode first).

Remote P2P playtester networking is a later phase — hosting the current app does **not** require WebSockets yet.

---

## Repo map

| Path | Purpose |
| --- | --- |
| `deploy/nginx/` | Reverse proxy templates + optional TLS |
| `docker-compose.prod.yml` | Production compose overrides |
| `.env.production.example` | Production env template |
| `scripts/vps-bootstrap.sh` | First-time VPS setup |
| `scripts/deploy-production.sh` | Build + migrate |
| `scripts/check-production-env.sh` | Pre-flight env validation |
| `scripts/backup-db.sh` | Postgres backup |
| `scripts/migrate-db.sh` | Apply SQL migrations |

For legal/ops expectations on OVH-style VPS hosting, see **Production legal + ops checklist (VPS)** in this file. For Law 25, data inventory, and **application-level encryption roadmap**, see **[`PRIVACY_AND_DATA_PROTECTION.md`](PRIVACY_AND_DATA_PROTECTION.md)**.
