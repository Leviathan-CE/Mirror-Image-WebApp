import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useDeckBoardMutations } from "@/hooks/useDeckBoardMutations"
import { fetchCardById } from "@/lib/api/cards"
import {
  addDeckCard,
  createDeckCategory,
  removeDeckCard,
  updateDeckCard,
  type DeckCardEntry,
  type DeckDetail,
} from "@/lib/api/decks"

vi.mock("@/lib/api/decks", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/decks")>(
    "@/lib/api/decks"
  )
  return {
    ...actual,
    addDeckCard: vi.fn(),
    updateDeckCard: vi.fn(),
    removeDeckCard: vi.fn(),
    createDeckCategory: vi.fn(),
    updateDeckCategory: vi.fn(),
    deleteDeckCategory: vi.fn(),
  }
})

vi.mock("@/lib/api/cards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/cards")>(
    "@/lib/api/cards"
  )
  return {
    ...actual,
    fetchCardById: vi.fn(),
  }
})

const fetchCardByIdMock = vi.mocked(fetchCardById)
const addDeckCardMock = vi.mocked(addDeckCard)
const updateDeckCardMock = vi.mocked(updateDeckCard)
const removeDeckCardMock = vi.mocked(removeDeckCard)
const createDeckCategoryMock = vi.mocked(createDeckCategory)

function cardEntry(
  id: number,
  categoryId: number,
  name = `Card ${id}`
): DeckCardEntry {
  return {
    quantity: 1,
    category_id: categoryId,
    category_name: "Pilot",
    sort_order: 0,
    card: { id, card_name: name, card_art_path: null },
  } as DeckCardEntry
}

function baseDeck(): DeckDetail {
  return {
    id: 1,
    name: "Deck",
    description: null,
    is_public: false,
    author_name: "me",
    cover_image_path: null,
    card_count: 1,
    categories: [
      { id: 10, name: "Pilot", sort_order: 0 },
      { id: 20, name: "Main", sort_order: 1 },
    ],
    cards: [cardEntry(100, 10, "Old Pilot")],
  } as unknown as DeckDetail
}

describe("useDeckBoardMutations assignPilot", () => {
  beforeEach(() => {
    fetchCardByIdMock.mockReset()
    addDeckCardMock.mockReset()
    updateDeckCardMock.mockReset()
    removeDeckCardMock.mockReset()
    createDeckCategoryMock.mockReset()
  })

  function setup(initialDeck: DeckDetail) {
    let deck: DeckDetail | null = initialDeck
    const setDeck = vi.fn((updater) => {
      deck =
        typeof updater === "function"
          ? (updater as (prev: DeckDetail | null) => DeckDetail | null)(deck)
          : updater
    })
    const loadDeck = vi.fn(async () => undefined)
    const { result, rerender } = renderHook(
      (props: { deck: DeckDetail | null }) =>
        useDeckBoardMutations({
          deck: props.deck,
          setDeck,
          token: "jwt",
          canEdit: true,
          saving: false,
          setSaving: vi.fn(),
          setErrorText: vi.fn(),
          loadDeck,
          clearCardSelection: vi.fn(),
        }),
      { initialProps: { deck } as { deck: DeckDetail | null } }
    )
    return {
      result,
      setDeck,
      loadDeck,
      getDeck: () => deck,
      sync: () => rerender({ deck }),
    }
  }

  it(
    "keeps the previous pilot on the deck when assigning a new one fails " +
      "server-side (no delete-then-add data loss window)",
    async () => {
      const deck = baseDeck()
      const { result, getDeck } = setup(deck)

      fetchCardByIdMock.mockResolvedValue({
        id: 200,
        card_name: "New Pilot",
        is_pilot: true,
        is_augment: false,
        card_art_path: null,
        super_types: [],
      })
      // The new pilot's add request fails (network blip, server error, ...).
      addDeckCardMock.mockRejectedValue(new Error("network_error"))

      await act(async () => {
        await result.current.assignPilot(200, null)
      })

      // The old pilot must still be intact — the failed add must never have
      // triggered a delete of the previous pilot entry.
      expect(removeDeckCardMock).not.toHaveBeenCalled()
      const cardsAfter = getDeck()?.cards ?? []
      expect(cardsAfter.some((c) => c.card.id === 100)).toBe(true)
    }
  )

  it("removes the old pilot only after the new one is confirmed", async () => {
    const deck = baseDeck()
    const { result, getDeck } = setup(deck)

    fetchCardByIdMock.mockResolvedValue({
      id: 200,
      card_name: "New Pilot",
      is_pilot: true,
      is_augment: false,
      card_art_path: null,
      super_types: [],
    })
    const newEntry = cardEntry(200, 10, "New Pilot")
    addDeckCardMock.mockResolvedValue(newEntry)
    removeDeckCardMock.mockResolvedValue(undefined)

    await act(async () => {
      await result.current.assignPilot(200, null)
    })

    expect(addDeckCardMock).toHaveBeenCalled()
    expect(removeDeckCardMock).toHaveBeenCalledWith(1, 100, 10, "jwt")
    const order =
      addDeckCardMock.mock.invocationCallOrder[0] <
      removeDeckCardMock.mock.invocationCallOrder[0]
    expect(order).toBe(true)

    const cardsAfter = getDeck()?.cards ?? []
    expect(cardsAfter.some((c) => c.card.id === 100)).toBe(false)
    expect(cardsAfter.some((c) => c.card.id === 200)).toBe(true)
  })
})
