# Mirror-Image-WebApp

The Mirror Image Everything app for sellers, buyer stats, meta, and card catalogue

## CI / AI code review

PRs and pushes to `main` run lint/tests and a secret scan (`.github/workflows/ci.yml`).
Non-draft PRs into `main` also get an AI review for **security, flaws, SRP, and readability** — see [`.github/ai-review/README.md`](./.github/ai-review/README.md) (add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` repo secret).

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

App URLs:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- Auth docs: `http://localhost:8000/docs` (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`)

### Dev seed accounts (local only)

Created on **first** DB init (empty volume), or by running `Backend/sql/09_seed_dev_users.sql` manually:

| Role | Username | Email | Password |
|------|----------|-------|----------|
| admin | `admin` | `admin@localhost` | `admin123` |
| distributor | `distributor` | `store@localhost` | `store123` |
| user | `user` | `user@localhost` | `user123` |

If your DB volume already exists:

```bash
docker compose exec -T db psql -U postgres -d mirror_image < Backend/sql/09_seed_dev_users.sql
```

Schema for new environments comes entirely from `Backend/sql/` init scripts
(see `Backend/sql/README.md`). For older volumes, apply scripts under
`Backend/sql/migrations/` (see that folder’s README).

Or wipe and recreate (destroys all data):

```bash
docker compose down -v
docker compose up --build
```

Optional environment variables:

- `SQL_PSWRD` (defaults to `postgres`)
- `POSTGRES_USER` (defaults to `postgres`)
- `POSTGRES_DB` (defaults to `mirror_image`)
- `POSTGRES_PORT` (defaults to `5433`)
- `JWT_SECRET` (required for real deployments; used to sign login tokens)
- `JWT_EXPIRE_HOURS` (defaults to `168` = 7 days)



## specifications



## card catalogue and search

- The primary purpose of the website is to be able to search for cards
- a place to store all rules and card-specific interactions
- ealisly broswe card by types, keyword, cost, colour and text
- add directly from search into a deck.



## deck building and sharing tool

- supports all constructed formats (sortie, squads)
  - sortie: 1v1 competitive format
  - squads 1v1v1v1 free for all
- tracks decks for easy look and copy and paste with auto tracking back to the original source.
- Decks are auto-saved dynamically
- The deck have view count and upvote count, and tags (that help describe the deck)



## competitive tracking tool

- Creating an account auto-sets up competitive tracking
- genrates uniqu player ID that can be scanned by a bar code.
  - as part genrating bar code, the user first has to register a deck from their list.
- authorized stores have special trourntment based game play.  
  - player must use the app and registar there deck to play competitively
  - option for non-competitive play where users can have guest code (no deck registration required)
- limited format randomizer
- constructed format randomizer
  - round robin
  - for larger events, tournment brackets system.
- Decks with high similarity get grouped under a particular strategy



## buying sealed product

- a store for both resellers and players alike to buy products
- also do pre-orders and Kickstarters
- a tool to auto-connect details directly to the supplier(manufacturer)

