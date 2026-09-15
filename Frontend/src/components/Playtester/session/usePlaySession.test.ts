/**
 * Regression coverage for usePlaySession.startTurn scalar-ref staleness.
 *
 * startTurn() fires two back-to-back dispatch() calls in the same event
 * handler: `lf` (life loss on deck-out) then `ts` (turn pass). Both read
 * `snapshot()`, which must see the *just-applied* life from the first
 * dispatch — otherwise `ts` silently reverts it. This can only be caught by
 * exercising the real hook (React batching applies), not the pure
 * `applyAction` reducer in isolation.
 */
import { type MutableRefObject } from "react"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ResourceColor } from "@/components/Playtester/session/accumulateResources.logic"
import {
  usePlaySession,
  type PlaySessionEffects,
} from "@/components/Playtester/session/usePlaySession"
import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckDetail } from "@/lib/api/decks"
import { deckEntry } from "@/test/deckEntry.fixture"

function deckWithNoLibraryCards(startingLife: number): DeckDetail {
  return {
    id: 1,
    name: "Empty Library Deck",
    description: null,
    is_public: false,
    author_name: "tester",
    cover_image_path: null,
    card_count: 1,
    // Only a Pilot section — no Main/Entity cards, so the shuffled library
    // (and hand, via hand_size: 0) is empty right from the opening deal.
    categories: [{ id: 1, name: "Pilot", sort_order: 0 }],
    cards: [
      deckEntry({
        card_id: 1,
        card_name: "Pilot",
        category_id: 1,
        category_name: "Pilot",
        quantity: 1,
        hand_size: 0,
        lif_capacity: startingLife,
      }),
    ],
  }
}

function renderEmptyLibrarySession(startingLife: number) {
  // Stable references across re-renders: usePlaySession re-deals the table
  // whenever `deck` (or `resourceByColor`) changes identity, so recreating
  // either inside the render callback would deal-loop forever.
  const deck = deckWithNoLibraryCards(startingLife)
  const noResources = new Map<ResourceColor, CardLibraryItem>()
  const effectsRef: MutableRefObject<Partial<PlaySessionEffects>> = {
    current: {},
  }
  return renderHook(() =>
    usePlaySession({
      status: "ready",
      deck,
      resourceByColor: noResources,
      resourcesReady: true,
      effectsRef,
    })
  )
}

describe("usePlaySession.startTurn deck-out life loss", () => {
  it("actually loses 1 life when the local/host player starts a turn with an empty library", () => {
    const { result } = renderEmptyLibrarySession(20)

    expect(result.current.life).toBe(20)
    expect(result.current.libraryCount).toBe(0)

    act(() => {
      result.current.startTurn(false)
    })

    expect(result.current.life).toBe(19)
  })

  it("keeps losing life on every subsequent deck-out turn", () => {
    const { result } = renderEmptyLibrarySession(3)

    act(() => {
      result.current.startTurn(false)
    })
    expect(result.current.life).toBe(2)

    act(() => {
      result.current.startTurn(false)
    })
    expect(result.current.life).toBe(1)

    act(() => {
      result.current.startTurn(false)
    })
    expect(result.current.life).toBe(0)
  })
})
