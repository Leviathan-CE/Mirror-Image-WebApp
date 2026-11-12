# Mirror Image API

How this backend is laid out, and how a client (web app or Unity) should talk to it.

Live contract: `GET /openapi.json` and the Swagger UI at `/docs`. This file is the map. OpenAPI is the field-level source of truth.

| Environment | Origin |
|---|---|
| Local | `http://127.0.0.1:8001` |
| Production | `https://api.mirrorimagetcg.net` |

All paths below are relative to that origin. Example: login is `POST {origin}/auth/login`.

---

## How the server is layered

```text
Client  →  FastAPI routers  →  security / visibility  →  SQL (Postgres)
                ↓
         signed /media URLs  →  image files
```

| Layer | Where | Job |
|---|---|---|
| Routers | `app/routers/` | HTTP: path, method, request body, status codes |
| Schemas | Pydantic models on the router (or `app/cards`, `app/decks`) | JSON shape. `ConfigDict(str_strip_whitespace=True)` trims strings on the way in |
| Security | `app/security.py` | Hash passwords, mint/verify JWTs, require Bearer / staff / admin |
| Domain | `app/card_publish.py`, `app/google_oauth.py`, `app/media_urls.py`, … | Rules that more than one route shares |
| Database | `app/db.py` + `sql/` | Connections and schema |

A router should not invent a second login table or a second card format. New HTTP goes in a router. New “who may see this card” goes in publish/visibility. New columns go in SQL.

`app/main.py` mounts the routers. Prefixes live on the router:

| Router file | URL prefix |
|---|---|
| `health.py` | `/health` |
| `auth.py` | `/auth` |
| `email_auth.py` | `/auth/email` |
| `card_manager.py` | `/cards` |
| `admin_cards.py` | `/cards/admin` |
| `decks.py` | `/decks` |
| `billing.py` | `/billing` |
| `play_rooms.py` | `/play` |
| `media.py` | `/media` |
| `assets.py` | `/assets` |
| `announcements_public.py` | `/announcements` |
| `admin_*.py` | `/admin` |

Fixed paths are registered **above** `/{id}` placeholders. `/cards/all_cards` must sit above `/cards/{card_id}`, or FastAPI treats `all_cards` as an integer id and returns `422`.

---

## How a client should use this API

Keep three pieces on the client. Do not put HTTP inside UI buttons or card ScriptableObjects.

1. **Wire models** — classes whose **public** field names match JSON keys (`identifier`, `id_token`, `card_name`). These are not game objects.
2. **Service** — one place that knows the origin, builds URLs, sets headers, and returns parsed models.
3. **Session** — stores `access_token` (and `expires_in` for Unity). Every later request reads the token from here.

Flow:

```text
Login / Google  →  AuthResponse.access_token
                 →  session
                 →  Authorization: Bearer <token>
                 →  /auth/me, /cards/all_cards, /decks/me, …
```

### Requests

- JSON bodies: `Content-Type: application/json`.
- Field names are `snake_case` as in OpenAPI. `password` not `passwrod`. `id_token` not `idToken` unless you add an alias on the server.
- Pydantic `str_strip_whitespace` trims incoming strings. Still trim on the client before send.
- `model_config` is **not** a JSON field. Do not send it.
- Extra JSON keys are usually ignored. Missing required keys are `422` with `detail[].loc`.

### Auth header

```http
Authorization: Bearer <access_token>
```

No token: `401` `missing_bearer_token`. Expired: `401` `token_expired`. Wrong role: `403` `staff_required` or `admin_required`.

Some catalogue routes accept an **optional** Bearer (`get_optional_user_id`). Guest sees published cards. A logged-in player sees unlocked sets. Staff sees the full table.

### `client: "unity"`

Password and Google login bodies take an optional `client` string.

| `client` | Token lifetime |
|---|---|
| omitted or `""` | `JWT_EXPIRE_HOURS` (default 7 days). Web app. |
| `"unity"` | `JWT_UNITY_EXPIRE_MINUTES` (default 10 minutes). Game / tooling. |

`AuthResponse.expires_in` is seconds until expiry when `client` is `unity`; otherwise `null`. Unity should refresh by logging in again before that clock runs out.

---

## Auth

### Register and password login

```http
POST /auth/register
{ "user_name": "levi", "email": "a@b.com", "password": "at-least-8" }

POST /auth/login
{ "identifier": "levi", "password": "at-least-8", "client": "unity" }
```

`identifier` is email **or** username. Success:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 600,
  "user": {
    "id": 1,
    "user_name": "levi",
    "email": "a@b.com",
    "role": "user",
    "subscription_status": "none",
    "subscription_type": "",
    "is_subscribed": false,
    "email_verified": true,
    "features": [],
    "preferences": {}
  }
}
```

Bad credentials: `401` `invalid_credentials`.

### Google

```http
GET  /auth/google/config
     → { "google_client_id": "...", "enabled": true }

POST /auth/google
{ "id_token": "<Google Identity Services JWT>", "client": "unity" }
```

`id_token` comes from Google after the player picks an account. The Google **client id** used to mint that token must match `GET /auth/google/config`. The API verifies the JWT; it does not accept a raw Google password.

If that email already has a password account: `409` `password_account_exists`. Then:

```http
POST /auth/google/link-with-password
{ "id_token": "<same jwt>", "password": "...", "client": "unity" }
```

After a successful link, later Google taps use only `POST /auth/google`.

Google not set up on the server: `503` `google_not_configured`.

### Session routes

```http
GET    /auth/me                         Bearer required
PATCH  /auth/me/preferences             Bearer required
DELETE /auth/me                         Bearer required (account delete)
```

Email verify / reset: `/auth/email/verify`, `/resend-verification`, `/forgot-password`, `/reset-password`, `/accept-invite`.

---

## Cards (Unity catalogue)

Guest or Bearer, depending on publish and unlocks.

```http
GET /cards/all_cards
    → { "items": [ CardByNameResponse, ... ] }

GET /cards/library?limit=50&offset=0
    → { "items": [...], "total", "limit", "offset" }

GET /cards/{card_id}
GET /cards/by-name/{card_name}
GET /cards/search?q=
GET /cards/facets
```

`CardByNameResponse` (one `all_cards` item) uses `ID` (uppercase), `card_name`, `cost`, capacities, `card_art_path`, `card_art_mime_type`, and the rest of the printed fields. Library rows use lowercase `id` and a thinner shape. Do not parse library JSON with the full-card model.

`GET /cards/{card_id}` is an **integer**. `/cards/all_cards` is a fixed name. Wrong order on the server → `422` `int_parsing` on `card_id`.

### Art

There is **no** `GET /cards/{id}/art`. Those paths are **POST** (staff upload from the card editor).

`card_art_path` is a signed relative URL:

```text
media/<set>/<file>.png?exp=<epoch>&sig=<hmac>
```

Fetch:

```http
GET {origin}/{card_art_path}
```

`200` + `image/png`. Bad, expired, or unknown signature → `404` (same body whether the file exists or not). `media/` is the HTTP route, not the disk folder. The signature is the permission; classified cards return no path.

Cache the PNG on the client. Do not download every thumbnail on every launch. `exp` is a few hours; a cached file outlives the URL.

Staff upload (Bearer admin/developer):

```http
POST /cards/                  create row
POST /cards/{id}/art          illustration PNG
POST /cards/{id}/thumbnail    full-card PNG
```

Admin browse: `/cards/admin/library`, `/cards/admin/bulk`, `/cards/admin/delete`.

---

## Media and assets

```http
GET /media/{key}?exp=&sig=     signed image (card art, covers)
GET /assets/card-back          signed card-back URL (Bearer required)
```

---

## Decks

Bearer required except public browse.

```http
GET    /decks/public
GET    /decks/me
POST   /decks
GET    /decks/{deck_id}
PATCH  /decks/{deck_id}
DELETE /decks/{deck_id}
GET    /decks/{deck_id}/cards
POST   /decks/{deck_id}/cards
PATCH  /decks/{deck_id}/cards/{card_id}
DELETE /decks/{deck_id}/cards/{card_id}
PUT    /decks/{deck_id}/cards/order
```

Also: categories, tags, likes, cover upload, default-categories.

---

## Play rooms

```http
POST /play/rooms
GET  /play/rooms/{code}
WS   /play/ws/rooms/{code}
```

The WebSocket still needs the JWT (query or first message — see `/docs` for the current handshake).

---

## Billing, site, admin

```http
GET  /billing/plan
GET  /billing/status              Bearer
POST /billing/checkout            Bearer
POST /billing/portal              Bearer
POST /billing/sync                Bearer
POST /billing/webhook             Stripe, not a user JWT

GET  /site/coming-soon
GET  /announcements
GET  /health
GET  /health/db
```

Admin (staff or admin JWT): `/admin/users`, `/admin/features`, `/admin/analytics`, `/admin/announcements`, `/admin/site/coming-soon`.

---

## Errors

FastAPI validation (`422`):

```json
{ "detail": [ { "type": "int_parsing", "loc": ["path", "card_id"], "msg": "...", "input": "all_cards" } ] }
```

App errors (`401` / `403` / `409` / `503`) usually:

```json
{ "detail": "invalid_credentials" }
```

`detail` is a stable string the client can switch on (`token_expired`, `password_account_exists`, `database_unavailable`, `google_not_configured`).

---

## Client checklist (Unity)

1. Wire models with **public** `snake_case` fields. `JsonUtility` skips private fields.
2. Password body: `identifier`, `password`, `client`. Google body: `id_token`, `client`.
3. `POST` JSON with `UploadHandlerRaw` and `Content-Type: application/json`. `UnityWebRequest.Post` form-encoding will `422`.
4. Save `access_token`. Send `Authorization: Bearer …` on `/auth/me` and player routes.
5. Catalogue: `GET /cards/all_cards` → `{ items: [...] }`. Art: `GET origin + card_art_path` → `downloadHandler.data`.
6. Cache JSON + PNG on `Application.persistentDataPath`. Skip the image GET when the file already exists.
7. Treat `/docs` as the live list of fields after any backend change.

The card **editor** Unity project POSTs cards and art. The **game** Unity project GETs the catalogue and media. Both use this same API. They do not share ScriptableObject folders.
