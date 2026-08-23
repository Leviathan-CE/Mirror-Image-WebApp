# Privacy & data protection (Mirror Image)

**Not legal advice.** This document is an engineering and compliance **planning guide** for operators of Mirror Image TCG. Have a Quebec/Canada privacy lawyer review before going live with accounts and payments.

Related: [`DEPLOY.md`](DEPLOY.md) (hosting, backups, OVH ops) · [`DEPLOY.md` — Production legal + ops checklist](DEPLOY.md#production-legal--ops-checklist-vps)

---

## Design principle: assume breach

We plan as if the **database dump, backup file, or VPS disk** will eventually be stolen.

| Layer | What it protects | What it does **not** protect |
| --- | --- | --- |
| HTTPS (Cloudflare + nginx) | Data in transit | Nothing at rest |
| Firewall / no public Postgres | Random internet scans | Insider, app RCE, stolen backup |
| bcrypt passwords | Password reuse if DB leaked | Weak user passwords (still slow to crack) |
| Hashed email tokens | Token replay from DB | — |
| **Application-level encryption (this plan)** | Plaintext PII in DB dumps | Live app if attacker has **keys + DB** |
| Off-server encrypted backups | Backup theft | — |

**Goal:** A stolen `.sql` dump or volume snapshot should **not** expose readable emails, OAuth links, or Stripe identifiers. Keys live **outside** the database (env / secret manager), rotated on a schedule.

---

## Law 25 & PIPEDA (plain language)

### Law 25 (Quebec)

**Law 25** updates Quebec’s private-sector privacy law (*Act respecting the protection of personal information in the private sector*). It modernizes rules for transparency, consent, security, breach notification, and individual rights — often compared to GDPR.

**Likely applies when:** you have Quebec users or operate in Quebec, even if you’re incorporated elsewhere in Canada.

**Core expectations:**

1. **Transparency** — privacy policy: what you collect, why, retention, subprocessors  
2. **Consent** — meaningful consent for collection/use (signup + policy link)  
3. **Purpose limitation** — only collect what the app needs  
4. **Security** — appropriate technical measures (encryption plan below)  
5. **Privacy officer** — named contact (can be you at first: `privacy@yourdomain`)  
6. **Breach notification** — serious incidents → regulator + affected people when required  
7. **Individual rights** — access, correction, deletion (process even if manual at first)  
8. **Cross-border transfers** — disclose that data may be processed/stored in Canada and by US providers (Stripe, Google, SMTP, etc.)

### PIPEDA (federal)

Federal private-sector privacy law for much of Canada. In practice, many Canadian sites maintain **one privacy policy** that satisfies both PIPEDA and Law 25 themes.

### Your subprocessors (disclose in privacy policy)

| Processor | Data they may see |
| --- | --- |
| **OVHcloud** (VPS) | All app/DB content on disk |
| **Cloudflare** | IP, HTTP metadata, cached static assets |
| **Stripe** | Email, payment/customer ids, billing events |
| **Google** | OAuth profile (email, sub) at sign-in |
| **SMTP provider** | Email address, message content for verify/reset |
| **Future:** analytics, error tracking — add before enabling |

---

## Personal data inventory (current schema)

What Mirror Image stores today (`Backend/sql/`):

### High sensitivity — encrypt at rest (Phase plan below)

| Table | Column(s) | Notes |
| --- | --- | --- |
| `users` | `email` | Login, verify, billing contact |
| `users` | `user_name` | Public handle but still personal info |
| `users` | `stripe_customer_id`, `stripe_subscription_id` | Payment linkage |
| `user_oauth_identities` | `subject` | Stable Google/Apple id |
| `user_oauth_identities` | `email_at_link` | Email snapshot at link time |

### Already protected (keep as-is)

| Table | Column(s) | Mechanism |
| --- | --- | --- |
| `users` | `password` | bcrypt (one-way) — **never** encrypt reversibly |
| `email_tokens` | `token_hash` | One-way hash — plaintext token only in email |

### Medium sensitivity — policy decision

| Table | Column(s) | Notes |
| --- | --- | --- |
| `decks` | `name`, `description` | **Public** decks are intentionally visible — encrypting at rest still helps dumps, but app must decrypt for community features |
| `deck_tags` | `tag`, `created_by` | Public when deck is public |
| `user_has_decks` | `user_id`, `is_public` | Relationship metadata |

### Lower / operational

| Data | Notes |
| --- | --- |
| `users.role`, subscription **status** enums | Not direct identity; keep plaintext for queries |
| Timestamps, counts, card catalogue | Game content, not personal |
| Server logs (if added) | Treat IPs as personal — minimize retention |

---

## Site legal pages (player-facing)

Before paid/public launch:

- [ ] **Terms of Use** — accounts, public decks, Stripe, termination  
- [ ] **Privacy Policy** — inventory above, subprocessors, retention, contact  
- [ ] **Acceptable use** — matches profanity filters + moderation  
- [ ] Signup / login — link to privacy policy (checkbox for terms if required)  
- [ ] **Privacy officer contact** — e.g. `privacy@mirrorimagetcg.net`  
- [ ] **Data request process** — email template for access/delete (manual OK v1)

User-generated public deck text is **your users’ content on your infrastructure** — host terms (OVH) and privacy law both put **you** in the accountability chain.

---

## VPS & host obligations (summary)

See [`DEPLOY.md` — Production legal + ops checklist](DEPLOY.md#production-legal--ops-checklist-vps). Highlights:

- **You** backup Postgres + `api_thumbnails`; host does not restore your app data  
- Use **external SMTP** — do not send mail from VPS port 25  
- **Auto-renew / late payment** can suspend the entire VPS  
- On cancel: export data **before** the machine is wiped  

---

## Encryption architecture (target state)

### Key hierarchy

```
┌─────────────────────────────────────────┐
│  KEK — Key Encryption Key               │
│  env: DATA_ENCRYPTION_KEY (32 bytes b64)│
│  OR cloud KMS / HashiCorp Vault (later) │
└─────────────────┬───────────────────────┘
                  │ wraps
┌─────────────────▼───────────────────────┐
│  DEK — per-row or per-user data key     │
│  stored in DB as encrypted blob         │
│  (optional v2; v1 can use single KEK)   │
└─────────────────┬───────────────────────┘
                  │ encrypts
┌─────────────────▼───────────────────────┐
│  Ciphertext columns (BYTEA or TEXT)     │
│  + blind indexes for lookup             │
└─────────────────────────────────────────┘
```

**v1 (simpler):** One `DATA_ENCRYPTION_KEY` in `.env` (never commit). AES-256-GCM per field with random IV prepended. Separate `SEARCH_HMAC_KEY` for blind indexes.

**v2 (stronger):** Per-user DEK wrapped by KEK; rotate KEK without re-encrypting all rows (re-wrap DEKs only).

### Blind indexes (searchable encryption)

Login and uniqueness checks need **lookup without decrypting every row**:

| Plaintext need | Storage | Lookup |
| --- | --- | --- |
| Email login | `email_ciphertext` | `email_blind_index = HMAC-SHA256(normalize(email), SEARCH_HMAC_KEY)` UNIQUE |
| Username | `user_name_ciphertext` | `user_name_blind_index` UNIQUE |
| OAuth (provider, subject) | `subject_ciphertext` | `(provider, subject_blind_index)` UNIQUE |

Normalize email: `lower(trim(email))`. Usernames: define one normalization (e.g. lower) and keep forever.

### Python application layer

Add `Backend/app/crypto/` (future implementation):

- `encrypt_field(plaintext: str) -> str` — base64(iv + ciphertext + tag)  
- `decrypt_field(blob: str) -> str`  
- `blind_index(value: str, purpose: str) -> str` — HMAC with purpose salt  
- **Never** log plaintext or keys  
- Unit tests with fixed test keys only in test env  

All reads/writes of protected columns go through **one module** — no scattered `encrypt()` calls.

### PostgreSQL

- Store ciphertext in `TEXT` or `BYTEA` columns  
- Keep blind indexes as `TEXT` with UNIQUE constraints  
- **Do not** rely on Postgres `pgcrypto` alone for app secrets if the DB role can `SELECT` everything — app-layer crypto with keys **not** in DB is the point  
- Optional: Postgres TDE / disk encryption on OVH — **defense in depth**, not a substitute  

### Backups

- `scripts/backup-db.sh` dumps **ciphertext** once migration is done — dumps stay useless without keys  
- Encrypt backup files at rest: `gpg --symmetric` or upload to encrypted object storage  
- Store backup keys **separate** from VPS `.env`  

---

## Implementation roadmap

### Phase 0 — Foundation (no schema change)

- [ ] Add `DATA_ENCRYPTION_KEY` and `SEARCH_HMAC_KEY` to `.env.production.example` (document generation: `openssl rand -base64 32`)  
- [ ] Document key rotation runbook (below)  
- [ ] Ensure production `.env` is never in git; restrict file perms on VPS (`chmod 600 .env`)  
- [ ] Minimize logs: no request bodies with passwords; no email in info-level logs  

### Phase 1 — Crypto module + tests

- [ ] Implement `app/crypto/field_encryption.py` (AES-256-GCM + blind index HMAC)  
- [ ] Pytest: round-trip, wrong key fails, blind index stable, normalization  
- [ ] Feature flag `ENCRYPTION_ENABLED=false` for local dev with legacy plaintext  

### Phase 2 — `users` table migration

New migration (example names):

```sql
-- users: add ciphertext + blind index columns; backfill; swap reads/writes
ALTER TABLE users ADD COLUMN email_ciphertext TEXT;
ALTER TABLE users ADD COLUMN email_blind_index TEXT UNIQUE;
ALTER TABLE users ADD COLUMN user_name_ciphertext TEXT;
ALTER TABLE users ADD COLUMN user_name_blind_index TEXT UNIQUE;
ALTER TABLE users ADD COLUMN stripe_customer_id_ciphertext TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id_ciphertext TEXT;
-- After backfill + app deploy: drop plaintext columns (separate migration)
```

- [ ] Backfill script: read plaintext → encrypt → write ciphertext + blind index (maintenance window)  
- [ ] Update `auth.py`, `email_auth.py`, `google_oauth.py`, `billing.py`, admin routers to use crypto layer  
- [ ] JWT payload: keep **`user id` only** — never put email in token claims  

### Phase 3 — OAuth identities

- [ ] Encrypt `user_oauth_identities.subject`, `email_at_link`  
- [ ] Blind index on `(provider, subject)` for Google callback lookup  

### Phase 4 — Deck content (optional tier)

Public community decks **must** be readable for search/display:

- [ ] **Option A:** Encrypt all deck name/description at rest; decrypt in API for public endpoints (dump protection)  
- [ ] **Option B:** Leave public deck text plaintext; encrypt only **private** decks (`is_public = false`)  

Document choice in privacy policy (“public decks are visible to other players”).

### Phase 5 — Backups & ops

- [ ] Wrap `backup-db.sh` output with GPG or push to encrypted bucket  
- [ ] Cron + off-server copy (see `DEPLOY.md`)  
- [ ] Quarterly **restore drill**  

### Phase 6 — Key rotation

1. Generate `DATA_ENCRYPTION_KEY_v2`  
2. Deploy app that decrypts with v1, re-encrypts with v2 on write (lazy migration) OR offline re-encrypt job  
3. Retire v1 after all rows migrated  
4. Rotate `SEARCH_HMAC_KEY` only with full re-index job (plan maintenance window)  

### Phase 7 — Compliance polish

- [ ] Privacy policy published and linked at signup  
- [ ] Record of processing (spreadsheet: column → purpose → retention → lawful basis)  
- [ ] Breach response template (who to notify, 72h clock for Law 25 serious incidents — confirm with counsel)  
- [ ] User delete account flow: purge ciphertext rows + Stripe customer handling  

---

## What to encrypt vs hash vs leave plain

| Data | Treatment | Why |
| --- | --- | --- |
| Password | **bcrypt** (existing) | Verify only; never decrypt |
| Email verify / reset token | **hash** (existing) | One-time secrets |
| Email, username | **encrypt + blind index** | Need lookup + dump resistance |
| Stripe ids | **encrypt** | Sensitive linkage; lookup by `user.id` |
| OAuth subject | **encrypt + blind index** | Stable id; dump resistance |
| JWT secret | **env only** | Not in DB |
| Public deck title | **encrypt (recommended)** or plain if product choice | Tradeoff: dump vs simplicity |

---

## If we are hacked (incident checklist)

1. **Contain** — rotate `JWT_SECRET`, `DATA_ENCRYPTION_KEY` (assume compromised), revoke Stripe webhook secret, force password reset for email/password users  
2. **Assess** — what was exfiltrated (DB dump? `.env`? backups?)  
3. **Notify** — legal counsel + Law 25 / PIPEDA breach rules if personal info involved  
4. **Users** — email affected accounts; Google-only users still affected if emails/subjects leaked  
5. **Post-mortem** — how attacker got keys or shell; fix before restore  

Encrypted columns help **only if keys were not stolen with the dump**. Store keys in a secret manager separate from the app server when you outgrow single-VPS.

---

## Open decisions (track before Phase 2)

| Decision | Options |
| --- | --- |
| Per-field vs JSON blob encryption | Per-field easier for partial queries; blob fewer columns |
| Public deck text | Encrypt at rest vs accept plaintext for public UGC |
| KMS | Env vars (v1) → Vault / cloud KMS (v2) |
| Account deletion | Hard delete vs anonymize (`user_id` retained for FK integrity) |

---

## References

- [CAI — Law 25 (Quebec)](https://www.cai.gouv.qc.ca/) — Commission d’accès à l’information  
- [OPC — PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/)  
- OVHcloud General Terms of Services (hosting — Content, backups, liability)  
- [`DEPLOY.md`](DEPLOY.md) — production deploy + ops checklist  

---

*Last updated: planning document on branch `getting_production_ready`. Implementation tracked via migrations in `Backend/sql/migrations/` when phases begin.*
