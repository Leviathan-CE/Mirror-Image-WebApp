# Frontend style guide

A short map of how this project names and organizes code. Follow these so new files match what is already here.

---

## File naming: the big rule

Ask: **is this file a React component?**

| Kind of file | Case / pattern | Examples |
| --- | --- | --- |
| React component (renders JSX) | **PascalCase** `.tsx` | `DeckPage.tsx`, `PlayingCard.tsx`, `DropdownMenu.tsx` |
| Feature **domain rules** (pure, no JSX) | **camelCase** + **`.logic.ts`** | `deck.logic.ts`, `playCard.logic.ts`, `accumulateResources.logic.ts` |
| API clients / HTTP | **camelCase** `.ts` under `lib/api/` | `cards.ts`, `decks.ts`, `auth.ts` |
| Shared utils | **camelCase** `.ts` | `utils.ts`, `route.ts` |
| Constants catalogs | **`constants.ts`** (one per feature folder) | `Playtester/constants.ts`, `cards/constants.ts`, `decks/constants.ts` |
| Style tokens (non-CSS) | **camelCase** + `Styles` | `headerStyles.ts`, `authFormStyles.ts` |
| Hooks | **camelCase** + `use` prefix | `useBootSequence.ts`, `useDeckDetail.ts` |
| Compatibility barrels | short name | `types.ts`, `index.ts` |
| Tests | Match the source file + `.test` | `deck.logic.test.ts`, `DeckPilotSlot.test.tsx` |

### Why `.logic.ts`?

Pure **behavior** (move cards, parse costs, subscription checks) is easy to confuse with UI when everything is just `.ts`. The `.logic` suffix means:

- no React components in this file
- safe to unit-test without mounting UI
- sits next to the feature’s `.tsx` files

```
PlayingCard.tsx           → UI
playCard.logic.ts         → session card rules
zoneMoves.logic.ts        → zone transfers
usePlayContextMenu.tsx    → hook (React)
constants.ts              → knobs / identity values (not rules)
```

**Do not** put `.logic` on API clients, hooks, utils, or style/constant catalogs — those already have a clear home/name.

### Why `constants.ts` (one per folder)?

Tunable values should be easy to find and change without hunting through UI or `.logic` files.

- **At most one** constants file per feature folder: always named **`constants.ts`** (lowercase — matches `cards/` / `decks/`; avoid `Constants.ts` / `*Constants.ts` so Windows and Linux stay in sync).
- **Put in it:** sizes, limits, MIME strings, icon maps, label copy, feature flags, identity enums (`PLAY_ZONE`, menu ids, …).
- **Keep out:** React components, hooks, drag/session behavior, API calls. Those stay in `.tsx` / `.logic.ts` / dedicated helpers (e.g. `deckCardDrag.ts` may *re-export* limits from `constants.ts`).
- Prefer **one source of truth** for a map (e.g. cost colour → icon in `cards/constants.ts`) over duplicating the same table in another folder.

### Why camelCase for logic, PascalCase for components?

- `DeckPilotSlot.tsx` → you import `<DeckPilotSlot />`
- `deck.logic.ts` → you import `applyCardMove`, `pilotCard`, etc.

### Exception: shadcn UI primitives

Some files under `components/ui/` follow the shadcn generator (`button.tsx`). Prefer **PascalCase** for components we author ourselves (`DropdownMenu.tsx`, `EditBox.tsx`). Do not rename generated shadcn files just for consistency unless you are deliberately standardizing that folder.

---

## What goes where

```
src/
  components/     Reusable UI + colocated *.logic.ts (by domain: decks/, Playtester/, …)
  pages/          Route-level screens (DeckPage, LoginPage, …)
  lib/            Shared helpers + API clients (lib/api/)
  hooks/          Shared React hooks
  styles/         Global / shared CSS
  test/           Test setup helpers
```

**Rule of thumb**

- Page owns routing and orchestration.
- Heavy **pure rules** (no React) → `feature.logic.ts` next to the feature.
- HTTP calls → `lib/api/*.ts` (no `.logic` suffix).
- Generic UI → `components/ui/`.

---

## Exports and imports

- Prefer **named exports** for logic modules:

  ```ts
  // deck.logic.ts
  export function applyCardMove(...) { ... }
  ```

- Prefer **default export** only when the file is clearly one page/component and the rest of the folder already does that (many pages do).

- Use the `@/` alias for app imports:

  ```ts
  import { applyCardMove } from "@/components/decks/deck.logic"
  import { cn } from "@/lib/utils"
  ```

- Import paths omit the `.ts` extension; keep the `.logic` segment:

  ```ts
  import { cardsInZone } from "@/components/Playtester/playCard.logic"
  // or via barrel while migrating:
  import { cardsInZone } from "@/components/Playtester/types"
  ```

---

## Tests

| Source | Test file |
| --- | --- |
| `deck.logic.ts` | `deck.logic.test.ts` |
| `DeckCardSearch.tsx` | `DeckCardSearch.test.tsx` |
| Logic still inside a component (temporary) | e.g. `DeckCardStack.logic.test.ts` — prefer extracting to `DeckCardStack.logic.ts` when it grows |

- **Unit-test** pure logic heavily (`*.logic.ts`).
- **Component-test** interactive pieces with Testing Library; mock `@/lib/api/*`.
- Prefer **not** mounting huge pages (like full `DeckPage`) for most cases; reserve E2E for smoke later.

Run:

```bash
npm run test:run
# or scoped:
npm run test:run -- src/components/decks
```

---

## React / TypeScript habits in this repo

- Match existing patterns in the file you touch (spacing, `cn()`, Tailwind class style).
- Prefer updating shared helpers over copying the same rule into another component.
- Do not use array **index as `key`** for dynamic lists; use a stable id.
- Do not mutate state in place; always use the setter with a new value/object.
- Avoid prop-drilling through many silent middle layers when Context or a shared helper already fits.
- Keep components focused: one job per section/component when practical.

---

## Quick checklist for a new file

1. Component that returns JSX? → `SomethingName.tsx`
2. Feature domain rules (pure)? → `somethingName.logic.ts`
3. Hook? → `useSomething.ts`
4. HTTP? → `lib/api/something.ts`
5. Constants / knobs for a feature folder? → that folder’s `constants.ts` (create if missing; don’t add a second specialty `*Icons.ts` / `*Constants.ts`)
6. Put it under the matching folder (`components/…`, `lib/…`, `pages/…`).
7. Add `*.test.ts(x)` next to it when it has non-trivial behavior.

---

## Examples from this project

```
DeckPage.tsx                    → page component
DeckCategorySection.tsx         → feature component
deck.logic.ts                   → deck builder rules (no JSX)
playCard.logic.ts               → playtester card session rules
accumulateResources.logic.ts    → resource pip / token matching
DeckCardSearch.test.tsx         → component test
deck.logic.test.ts              → unit test for rules
lib/api/decks.ts                → API client module
lib/utils.ts                    → shared util (cn, etc.)
lib/subscription.logic.ts       → entitlement helpers
Playtester/constants.ts         → zone / menu / pile knobs
cards/constants.ts              → cost token → icon maps
decks/constants.ts              → max copies, drag MIME, classified copy
```

When unsure, open a neighbor file in the same folder and copy its naming pattern.
