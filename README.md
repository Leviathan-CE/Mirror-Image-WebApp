# Mirror-Image-WebApp
The Mirror Image Everything app for sellers, buyer stats, meta, and card catalogue

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build
```

App URLs:
- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`

Optional environment variables:
- `SQL_PSWRD` (defaults to `postgres`)
- `POSTGRES_USER` (defaults to `postgres`)
- `POSTGRES_DB` (defaults to `mirror_image`)
- `POSTGRES_PORT` (defaults to `5433`)

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
