# Two-player playtester — implementation plan

Plan for turning the single-player playtester into a two-player game, first on
one screen and then across two browsers. Written 2026-08-03 against the current
working tree.

## Goal

Two players, each with their own deck, hand, board, and life total, able to play
a game of Mirror Image against each other. Networking is the *last* phase, not
the first.

## Where we are starting from

Measured, not estimated:

| Fact | Value |
| --- | --- |
| Playtester code (non-test) | 7,878 lines — 6,696 in `Frontend/src/components/Playtester`, 1,182 in `PlayTesterPage.tsx` |
| Pure logic modules | 1,510 lines in `*.logic.ts` |
| `setSessionCards` call sites | 53, across 3 files |
| Nondeterministic calls | 4, across 2 files (one shuffle, three ID mints from `Date.now`/`Math.random`) |
| `getBoundingClientRect` calls | 28, across 6 files |
| Backend realtime support | none — no WebSocket, SSE, Redis, or pub/sub anywhere |

The important structural facts:

- All game truth is one flat array, `sessionCards: PlayingCardInstance[]`, where
  each card carries a global `zone` string. Everything on screen is derived with
  `cardsInZone(sessionCards, zone)`.
- No card or zone has an owner. `life`, `turn`, `pilotGenBonus`, and
  `pilotHandSize` are single scalars.
- There is no reducer. State changes happen wherever they are convenient, and
  some paths also patch `sessionCardsRef.current` by hand so timers and keyboard
  handlers can read fresh state.
- The rules themselves are pure `cards[] → cards[]` functions with no React or
  DOM inside. This is the part that makes the whole plan tractable.

## Decisions to lock before writing code

These three choices shape every phase. Recommendations given, but they are
yours to make.

1. **Trust model.** Do both players see everything (a shared playtest between
   two people), or is hidden information enforced? *Recommendation: trusted
   first, hidden zones in phase 5.* Enforcing it early doubles the work of every
   earlier phase.
2. **Authority.** Does one client own the game state and tell the other what
   happened, or do both simulate independently? *Recommendation:
   host-authoritative.* Only the host shuffles, so the determinism problem
   mostly disappears.
3. **Zone layout.** Mirror the board (opponent above, rotated) or side-by-side?
   *Recommendation: mirrored rows*, because it keeps each player's own zones in
   the position they already know from single-player.

## Phase 1 — Ownership in the model

No visible change. The model gains the ability to express two sides.

**Changes**

- `playCard.logic.ts`: add `owner: PlayerSlot` to `PlayingCardInstance`, where
  `PlayerSlot = "p1" | "p2"`. Update `deckEntryToPlayInstance` and
  `expandDeckToPlayInstances` to stamp it.
- `playtesterConstants.ts`: add the `PlayerSlot` type. Zone names stay global —
  ownership lives on the card, not in the zone string, so no existing zone logic
  breaks.
- `playCard.logic.ts`: `cardsInZone(cards, zone)` gains an owner argument.
  Every caller must pass one; that is the point of doing it as a signature
  change rather than an optional parameter.
- `selectableActionTargets` and `readyBattlefieldAndStockpile`: scope to a
  single owner so a player cannot ready or select the opponent's cards.
- `zoneMoves.logic.ts`: moves must preserve `owner`. A card returning to a
  library goes to *its own* library.
- Per-player scalars: replace `life`, `pilotGenBonus`, `pilotHandSize` with a
  `Record<PlayerSlot, number>` shape in `PlayTesterPage`.

**Tests first.** Extend `playCard.logic.test.ts` and `zoneMoves.logic.test.ts`
with two-owner fixtures before touching the components. Ownership bugs are
invisible in single-player and obvious in a unit test.

**Done when:** the app behaves exactly as today with everything owned by `p1`,
and the suite proves a `p2` card is never returned by a `p1` query.

## Phase 2 — Hotseat (two boards, one screen)

Still no networking. This is where two-player play actually becomes testable.

**Changes**

- `PlayTesterPage.tsx`: load a second deck (route param or an in-page picker),
  run `setupOpeningSession` twice with different owners, and merge into one
  `sessionCards`.
- `setupOpeningSession.logic.ts`: take an owner argument. The existing "for one
  player" comment marks the spot.
- Layout: a mirrored opponent row above the battlefield — hand, deck,
  trashyard, dismantled, stockpile, pilot for `p2`. Reuse the existing
  components; they take `cards` arrays, so they need no internal changes.
- Add an active-player notion: `activePlayer: PlayerSlot`, a pass-turn control,
  and make `onStartTurn` / `onEndTurn` operate on the active player only.
- Gate interaction on ownership so the inactive board is view-only (or
  freely editable, if you want a loose sandbox — decide here).

**Done when:** a full game can be played by two people sharing a keyboard.

## Phase 3 — One commit path and determinism

The refactor that makes networking possible. Highest regression risk; do it
with the hotseat build working so you can A/B behaviour.

**Changes**

- New `sessionActions.logic.ts`: a `SessionAction` union (every mutation as a
  plain serializable value) plus `applyAction(state, action) → state`. Each case
  delegates to the existing pure logic functions; no new rules logic.
- New `rng.logic.ts`: seeded PRNG (xorshift or mulberry32) and a monotonic ID
  minter. Replace `Math.random()` in `shuffleInPlace`, and the `Date.now()` IDs
  in `duplicatePlayingCard` and `spawnResourceTokenInstance`. The seed becomes
  part of session state.
- Funnel all 53 `setSessionCards` call sites in `PlayTesterPage.tsx`,
  `useCardDragDrop.ts`, and `useDrawAnimations.ts` through one `dispatch`
  helper.
- Normalize free-float positions: store `x`/`y` as a fraction of the zone box
  rather than raw pixels, so two window sizes agree. Convert at the edges in
  `clientToSurfaceLocal` / `clientToStockpileLocal` and in `FreeFloatSurface`.

**Watch out for this one.** `useDrawAnimations` currently owns real state
transitions — a card lands in its target zone when the flip animation
*completes*, not when the drag ends. Splitting "the move happened" from "the
move is being animated" is the fiddliest work in the whole plan. Write the
action-log tests before touching it, and keep animations as local reactions to
committed actions.

**Done when:** the game can be driven entirely by a list of actions, and
replaying the same action list with the same seed reproduces the same board.

## Phase 4 — Transport

**Why a WebSocket relay rather than WebRTC:** true peer-to-peer still needs a
signaling server, and when both players are behind unfriendly NATs it falls back
to a TURN relay we would have to run and pay for. At two players the latency
difference is irrelevant. A relay on the API we already deploy is simpler and
easier to debug.

**Backend**

- New `Backend/app/routers/play_rooms.py`: a WebSocket router with in-memory
  rooms — create/join by code, JWT-authenticated, relay messages between the two
  members. Register in `app/main.py` alongside the existing routers.
- No new tables and no new dependencies: `uvicorn[standard]` already pulls in
  the `websockets` package, so FastAPI's WebSocket support works as-is.
- Rooms are ephemeral; a dropped game is re-created, not recovered.
- Note the single uvicorn worker: in-memory rooms work today, but scaling to
  multiple workers would need Redis (or sticky routing) for cross-worker
  delivery. Document that limit rather than pre-solving it.

**Frontend**

- New `useNetSession.ts`: connect, join, send intents, receive state.
- Host applies every action through `applyAction` and broadcasts the resulting
  state (or the action, once you trust replay). Guest sends intents and renders
  what it is told.
- Reconnect by resending full state — cheaper and safer than replaying a log.

**Done when:** two browsers on different machines can play one game.

## Phase 5 — Hidden information

Only worth doing once the rest works.

- Per-recipient state filtering: library contents and face-down cards travel as
  counts, not cards.
- Deck search and peek stay strictly local to the owner.
- The host does the filtering, which is the natural consequence of
  host-authority — though note it also means the host's client technically
  knows everything. True cheat resistance needs a server-authoritative
  rewrite, which is out of scope.

## Risks

| Risk | Mitigation |
| --- | --- |
| Animation-owned transitions double-apply or get lost over the network | Separate commit from animation in phase 3; test the action log directly |
| Ownership leaks let a player touch the opponent's cards | Signature change on `cardsInZone` forces every call site to be reviewed |
| Position drift between differently sized windows | Normalize `x`/`y` to zone fractions before anything crosses the wire |
| Phase 3 regressions in a 6.7k-line surface | Keep hotseat working as the reference behaviour; land the refactor in small commits |
| Rooms lost on API restart | Accept it — rooms are ephemeral by design |

## Out of scope

- Server-side rules enforcement or anti-cheat.
- Spectators, more than two players, tournaments, matchmaking.
- Persisting games across sessions.
- Mobile / touch layout for two boards.
