# Deploying Mirror Image (production)

This app is **not** a static site. Cloudflare (domain + email) is only the front door.
You still need somewhere that runs your three Docker services:

1. **frontend** — React/Vite build served by nginx  
2. **api** — FastAPI (Python) on port 8000  
3. **db** — PostgreSQL 16  

Locally that is already `docker compose up --build` from the repo root.

---

## What Cloudflare does vs what it does not

| You already have | What it actually does |
| --- | --- |
| Domain on Cloudflare | DNS names (`mirrorimage.example` → an IP or hostname) |
| Cloudflare Email Routing / Email | Usually **receive** mail to your domain (and forward) |
| Cloudflare proxy (orange cloud) | HTTPS, DDoS, CDN in front of *whatever host you point at* |

| Cloudflare does **not** replace | Why |
| --- | --- |
| Running FastAPI | Needs a long-lived Python process |
| Running Postgres | Needs a database server (or managed DB) |
| Sending transactional email | Email Routing is not a full SMTP “send as” product for app mail (password reset, verify). Use Resend, Postmark, Amazon SES, or your host’s SMTP |

**Mental model:** Cloudflare = DNS + HTTPS shield. Host = the machine/service that runs Docker.

---

## Production code path (branches)

- Active feature work lives on **`p2p-play`** (auth, Stripe, Google sign-in, playtester, migrations, richer `.env`).
- **`main`** is behind. Do **not** deploy `main` as-is if you want current features.

### Recommended merge flow

1. Open a PR: `p2p-play` → `main`.
2. Review / smoke-test locally from `p2p-play`:
   ```bash
   git checkout p2p-play
   cp .env.example .env   # then edit secrets
   docker compose up --build
   ```
3. Merge the PR when you are happy.
4. Deploy from **`main`** after that merge (or deploy `p2p-play` directly until then).

`p2p-play` still has UX polish in progress. “Production” here means **hostable**, not “perfect UI.” Ship when auth, catalogue, decks, and billing paths you care about work.

---

## Hosting options (ranked for this repo)

### Option A — Small VPS + Docker Compose + Cloudflare DNS (**best default**)

**Examples:** Hetzner Cloud, DigitalOcean Droplet, Linode, Vultr (~$5–12/mo).

**Why it fits:** You already have root `docker-compose.yml`. Same mental model as local. Full control for Postgres volumes, card thumbnails volume, Stripe webhooks, SMTP.

**Shape:**

```
Browser
  → Cloudflare (DNS + HTTPS)
    → VPS :443 (Caddy or nginx reverse proxy)
      → frontend container :80
      → api container :8000
      → db container :5432 (NOT exposed to the public internet)
```

**High-level steps:**

1. Create a VPS (Ubuntu 22.04/24.04).
2. Install Docker Engine + Docker Compose plugin.
3. Clone the repo; check out the branch you want to ship.
4. Create production `.env` (see checklist below). **Never** commit it.
5. Point Cloudflare DNS:
   - `A` / `AAAA` for `@` and `www` → VPS IP (proxied), **or**
   - later: `api` subdomain if you split hosts.
6. Put Caddy or nginx on the host (or a `caddy` compose service) so:
   - `https://yourdomain` → frontend  
   - `https://yourdomain/api` **or** `https://api.yourdomain` → FastAPI  
7. Set `VITE_API_URL` to the **public** API URL the **browser** will call, then rebuild frontend (Vite bakes this at build time).
8. Set `APP_ENV=production`, `FRONTEND_URL=https://yourdomain`, strong `JWT_SECRET`, real DB password.
9. Open only 80/443 on the firewall; do not publish Postgres to the world.

**Pros:** Cheapest honest fit; matches the repo; easy Stripe webhooks.  
**Cons:** You are the sysadmin (updates, backups, disk).

---

### Option B — PaaS that runs containers (easier ops, more $)

**Examples:** Railway, Render, Fly.io, Google Cloud Run + Cloud SQL.

**Typical split:**

- Managed **Postgres** addon  
- **API** service from `Backend/Dockerfile`  
- **Frontend** static/nginx from `Frontend/Dockerfile` (or build static and host on Cloudflare Pages / any static host)

**Pros:** Less SSH; backups/metrics often built-in.  
**Cons:** Multi-service wiring + volumes (thumbnails) + env at build time for Vite is fiddlier than one VPS compose stack.

Use this if you do not want to manage a Linux box.

---

### Option C — Cloudflare-only (Pages / Workers) — **not enough alone**

Cloudflare Pages is great for **static** frontends. Workers are for edge JS.

This backend is **FastAPI + Postgres + local thumbnail storage**. That does not map cleanly to Pages/Workers without rewriting the backend and moving the DB/files elsewhere.

**Sensible hybrid later:**  
Frontend on Cloudflare Pages + API on a VPS/PaaS + Postgres managed.  
**Today:** Option A (or B) is the straight line.

---

## Production env checklist

Copy from `.env.example` on `p2p-play` and change at least:

| Variable | Production expectation |
| --- | --- |
| `APP_ENV` | `production` |
| `POSTGRES_PASSWORD` | Long random; not `postgres` |
| `JWT_SECRET` | Long random (≥32 bytes) |
| `FRONTEND_URL` | `https://your.domain` |
| `FRONTEND_ORIGINS` | Exact browser origins (include `www` if used) |
| `VITE_API_URL` | Public API URL (baked into frontend image) |
| `STRIPE_*` | Live keys only when you intend live charges |
| `GOOGLE_CLIENT_ID` | Web client; authorized origins = your real HTTPS site |
| `SMTP_*` / `MAIL_FROM` | Real outbound mail provider for verify/reset |

Also:

- Stripe webhook endpoint must hit the **public** API URL (`/billing/webhook`).
- Google OAuth JS origins must match the live site.
- Run DB migrations on existing volumes (`npm run migrate` on `p2p-play`).
- Back up the Postgres volume and `api_thumbnails` volume.

---

## Suggested first production cut

1. Merge `p2p-play` → `main` when smoke tests pass.  
2. Rent one small VPS; deploy with Docker Compose.  
3. Cloudflare DNS → VPS; enable proxy (orange cloud) for HTTPS.  
4. Use a real SMTP provider for app email (keep Cloudflare for DNS + inbound if you want).  
5. Start with Stripe **test** mode on the live domain until checkout is verified, then switch to live keys.  
6. Add automated DB backups before you care about real users.

---

## What “ready” means for this repo

Ready to host when:

- [ ] Branch to deploy includes the features you need (`p2p-play` or merged `main`)
- [ ] Strong secrets in `.env` (not defaults)
- [ ] `VITE_API_URL` + CORS/`FRONTEND_*` match the public URLs
- [ ] Postgres not exposed publicly
- [ ] HTTPS via Cloudflare (or Caddy)
- [ ] Stripe webhook + Google origins updated for the live domain
- [ ] Outbound email works for verify/reset
- [ ] You have a backup plan for DB + thumbnails

Networking for true remote P2P playtester is still a later phase (see `Multiplayer_plan.md` on `p2p-play`). Hosting the current app does **not** require WebSockets yet.
