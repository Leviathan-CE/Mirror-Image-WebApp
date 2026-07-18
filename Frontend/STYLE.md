# Frontend style guide

A short map of how this project names and organizes code. Follow these so new files match what is already here.

---

## File naming: the big rule

Ask: **is this file a React component?**

| Kind of file | Case | Examples |
| --- | --- | --- |
| React component (renders JSX) | **PascalCase** | `DeckPage.tsx`, `DeckPilotSlot.tsx`, `DropdownMenu.tsx` |
| Logic / helpers / API / utils | **camelCase** | `deckLogic.ts`, `utils.ts`, `cards.ts`, `decks.ts` |
| Hooks | **camelCase** + `use` prefix | `useBootSequence.ts`, `useActiveSection.ts` |
| Tests | Match the source file + `.test` | `deckLogic.test.ts`, `DeckPilotSlot.test.tsx` |
| Types-only modules (when used) | **camelCase** or domain name | often live next to the API module |

### Why `deckLogic.ts` not `DeckLogic.ts`?

`deckLogic` exports **functions and constants**, not a component. The filename mirrors that:

- `DeckPilotSlot.tsx` → you import `<DeckPilotSlot />`
- `deckLogic.ts` → you import `applyCardMove`, `deckCardCount`, etc.

Same idea as `utils.ts` and `lib/api/decks.ts`.

### Exception: shadcn UI primitives

Some files under `components/ui/` follow the shadcn generator (`button.tsx`). Prefer **PascalCase** for components we author ourselves (`DropdownMenu.tsx`, `EditBox.tsx`). Do not rename generated shadcn files just for consistency unless you are deliberately standardizing that folder.

---

## What goes where

```
src/
  components/     Reusable UI pieces (by domain: decks/, ui/, …)
  pages/          Route-level screens (DeckPage, LoginPage, …)
  lib/            Shared helpers + API clients (lib/api/)
  hooks/          Shared React hooks
  styles/         Global / shared CSS
  test/           Test setup helpers
```

**Rule of thumb**

- Page owns routing and orchestration.
- Heavy **pure rules** (no React) → extract next to the feature (`components/decks/deckLogic.ts`).
- HTTP calls → `lib/api/*.ts`.
- Generic UI → `components/ui/`.

---

## Exports and imports

- Prefer **named exports** for logic modules:

  ```ts
  // deckLogic.ts
  export function applyCardMove(...) { ... }
  ```

- Prefer **default export** only when the file is clearly one page/component and the rest of the folder already does that (many pages do).

- Use the `@/` alias for app imports:

  ```ts
  import { applyCardMove } from "@/components/decks/deckLogic"
  import { cn } from "@/lib/utils"
  ```

---

## Tests

| Source | Test file |
| --- | --- |
| `deckLogic.ts` | `deckLogic.test.ts` |
| `DeckCardSearch.tsx` | `DeckCardSearch.test.tsx` |
| Logic colocated with a component | e.g. `DeckCardStack.logic.test.ts` |

- **Unit-test** pure logic heavily (`deckLogic`).
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
2. Pure functions / constants? → `somethingName.ts`
3. Hook? → `useSomething.ts`
4. Put it under the matching folder (`components/…`, `lib/…`, `pages/…`).
5. Add `*.test.ts(x)` next to it when it has non-trivial behavior.

---

## Examples from this project

```
DeckPage.tsx              → page component
DeckCategorySection.tsx   → feature component
deckLogic.ts              → deck business rules (no JSX)
DeckCardSearch.test.tsx   → component test
deckLogic.test.ts         → unit test for rules
lib/api/decks.ts          → API client module
lib/utils.ts              → shared util (cn, etc.)
```

When unsure, open a neighbor file in the same folder and copy its naming pattern.
