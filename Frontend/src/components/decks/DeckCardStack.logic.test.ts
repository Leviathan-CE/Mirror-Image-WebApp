import { describe, expect, it } from "vitest"

import {
  cardsFromDragPayload,
  DECK_CARD_DRAG_MIME,
  DECK_CARD_MAX_COPIES,
  deckCardSelectionKey,
  isDeckCardDrag,
  parseDeckCardDrag,
  type DeckCardDragPayload,
} from "./DeckCardStack"

function fakeDataTransfer(
  data: Record<string, string> = {},
  types: string[] = Object.keys(data)
): DataTransfer {
  return {
    types,
    getData: (type: string) => data[type] ?? "",
  } as unknown as DataTransfer
}

describe("deckCardSelectionKey", () => {
  it("joins category and card id", () => {
    expect(deckCardSelectionKey(12, 99)).toBe("12:99")
  })
})

describe("cardsFromDragPayload", () => {
  it("returns the primary card when cards[] is missing", () => {
    const payload: DeckCardDragPayload = {
      cardId: 5,
      fromCategoryId: 2,
    }
    expect(cardsFromDragPayload(payload)).toEqual([
      { cardId: 5, fromCategoryId: 2 },
    ])
  })

  it("returns cards[] when present", () => {
    const payload: DeckCardDragPayload = {
      cardId: 5,
      fromCategoryId: 2,
      cards: [
        { cardId: 5, fromCategoryId: 2 },
        { cardId: 8, fromCategoryId: 3 },
      ],
    }
    expect(cardsFromDragPayload(payload)).toEqual(payload.cards)
  })

  it("falls back to primary when cards[] is empty", () => {
    const payload: DeckCardDragPayload = {
      cardId: 5,
      fromCategoryId: 2,
      cards: [],
    }
    expect(cardsFromDragPayload(payload)).toEqual([
      { cardId: 5, fromCategoryId: 2 },
    ])
  })
})

describe("parseDeckCardDrag", () => {
  it("parses MIME payload", () => {
    const payload = {
      cardId: 7,
      fromCategoryId: 1,
      cards: [{ cardId: 7, fromCategoryId: 1 }],
    }
    const event = {
      dataTransfer: fakeDataTransfer({
        [DECK_CARD_DRAG_MIME]: JSON.stringify(payload),
      }),
    }
    expect(parseDeckCardDrag(event)).toEqual(payload)
  })

  it("parses text/plain fallback", () => {
    const payload = { cardId: 3, fromCategoryId: 9 }
    const event = {
      dataTransfer: fakeDataTransfer({
        "text/plain": JSON.stringify(payload),
      }),
    }
    expect(parseDeckCardDrag(event)).toEqual(payload)
  })

  it("filters invalid cards entries", () => {
    const event = {
      dataTransfer: fakeDataTransfer({
        [DECK_CARD_DRAG_MIME]: JSON.stringify({
          cardId: 1,
          fromCategoryId: 2,
          cards: [
            { cardId: 1, fromCategoryId: 2 },
            { cardId: "bad", fromCategoryId: 2 },
          ],
        }),
      }),
    }
    expect(parseDeckCardDrag(event)).toEqual({
      cardId: 1,
      fromCategoryId: 2,
      cards: [{ cardId: 1, fromCategoryId: 2 }],
    })
  })

  it("returns null for invalid JSON", () => {
    const event = {
      dataTransfer: fakeDataTransfer({
        [DECK_CARD_DRAG_MIME]: "not-json",
      }),
    }
    expect(parseDeckCardDrag(event)).toBeNull()
  })
})

describe("isDeckCardDrag", () => {
  it("detects the deck-card MIME type", () => {
    const event = {
      dataTransfer: fakeDataTransfer({}, [DECK_CARD_DRAG_MIME]),
    }
    expect(isDeckCardDrag(event)).toBe(true)
  })

  it("is false without MIME or active drag", () => {
    const event = {
      dataTransfer: fakeDataTransfer({}, ["text/plain"]),
    }
    expect(isDeckCardDrag(event)).toBe(false)
  })
})

describe("DECK_CARD_MAX_COPIES", () => {
  it("is 3", () => {
    expect(DECK_CARD_MAX_COPIES).toBe(3)
  })
})
