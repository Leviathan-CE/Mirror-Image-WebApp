import { describe, expect, it } from "vitest"

import {
  PRINTOUT_MARGIN_DEFAULT_MM,
  PRINTOUT_MARGIN_MAX_MM,
  PRINTOUT_MARGIN_MIN_MM,
  collectDeckPrintoutSlots,
  computePrintoutGridLayout,
  defaultPrintoutFileName,
  duplexBackIndex,
  printoutPageCount,
  resolvePrintoutFileName,
} from "@/components/decks/deckPrintout.logic"
import type { DeckCardEntry, DeckCategoryOut, DeckDetail } from "@/lib/api/decks"
import { deckEntry } from "@/test/deckEntry.fixture"

function category(
  id: number,
  name: string,
  sort_order: number,
  in_deck = true
): DeckCategoryOut {
  return { id, name, sort_order, in_deck }
}

function card(
  overrides: Parameters<typeof deckEntry>[0] & { category_id: number }
): DeckCardEntry {
  return deckEntry({
    card_art_path: "/media/test.png",
    ...overrides,
  })
}

function deck(
  categories: DeckCategoryOut[],
  cards: DeckCardEntry[]
): DeckDetail {
  return {
    id: 1,
    name: "Test Deck",
    description: null,
    is_public: false,
    author_name: "Tester",
    cover_image_path: null,
    card_count: cards.reduce((n, c) => n + c.quantity, 0),
    categories,
    cards,
  }
}

describe("duplexBackIndex", () => {
  it("mirrors columns within each row for long-edge duplex", () => {
    // Front: 0 1 2 / 3 4 5 / 6 7 8  →  Back: 2 1 0 / 5 4 3 / 8 7 6
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => duplexBackIndex(i))).toEqual([
      2, 1, 0, 5, 4, 3, 8, 7, 6,
    ])
  })
})

describe("collectDeckPrintoutSlots", () => {
  it("includes pilot, objectives, and in-deck main rows expanded by quantity", () => {
    const categories = [
      category(1, "Pilot", -1),
      category(2, "Objectives", -2),
      category(3, "Entity", 0, true),
      category(4, "Sideboard", 1, false),
    ]
    const cards = [
      card({ card_id: 10, category_id: 1, card_name: "My Pilot" }),
      card({ card_id: 20, category_id: 2, card_name: "Hold Site", quantity: 1 }),
      card({ card_id: 21, category_id: 2, card_name: "Relay", quantity: 1 }),
      card({ card_id: 30, category_id: 3, card_name: "Unit", quantity: 2 }),
      card({ card_id: 40, category_id: 4, card_name: "Side", quantity: 3 }),
    ]

    const slots = collectDeckPrintoutSlots(deck(categories, cards))
    expect(slots.map((s) => s.card_name)).toEqual([
      "My Pilot",
      "Hold Site",
      "Relay",
      "Unit",
      "Unit",
    ])
    expect(slots[0]?.section).toBe("pilot")
    expect(slots[1]?.section).toBe("objective")
    expect(slots[3]?.section).toBe("deck")
  })

  it("treats a legacy Augments section as objectives", () => {
    const categories = [
      category(1, "Pilot", -1),
      category(2, "Augments", -2),
      category(3, "Entity", 0, true),
    ]
    const cards = [
      card({ card_id: 10, category_id: 1, card_name: "My Pilot" }),
      card({ card_id: 20, category_id: 2, card_name: "Aug A", quantity: 1 }),
      card({ card_id: 30, category_id: 3, card_name: "Unit", quantity: 1 }),
    ]

    const slots = collectDeckPrintoutSlots(deck(categories, cards))
    expect(slots.map((s) => s.card_name)).toEqual(["My Pilot", "Aug A", "Unit"])
    expect(slots[1]?.section).toBe("objective")
  })
})

describe("computePrintoutGridLayout", () => {
  it("shrinks cards when the margin grows", () => {
    const tight = computePrintoutGridLayout(PRINTOUT_MARGIN_MIN_MM)
    const loose = computePrintoutGridLayout(PRINTOUT_MARGIN_MAX_MM)
    expect(loose.cardW).toBeLessThan(tight.cardW)
    expect(loose.cardH).toBeLessThan(tight.cardH)
  })

  it("clamps margin outside the allowed range", () => {
    expect(computePrintoutGridLayout(0).marginMm).toBe(PRINTOUT_MARGIN_MIN_MM)
    expect(computePrintoutGridLayout(99).marginMm).toBe(PRINTOUT_MARGIN_MAX_MM)
    expect(computePrintoutGridLayout(Number.NaN).marginMm).toBe(
      PRINTOUT_MARGIN_DEFAULT_MM
    )
  })
})

describe("printout file name", () => {
  it("appends _printout.pdf to a deck name", () => {
    expect(defaultPrintoutFileName("My Deck")).toBe("My_Deck_printout.pdf")
  })

  it("keeps an explicit .pdf suffix", () => {
    expect(resolvePrintoutFileName("core-set.pdf", "ignored")).toBe(
      "core-set.pdf"
    )
  })
})

describe("printoutPageCount", () => {
  it("counts 3×3 sheets", () => {
    expect(printoutPageCount(0)).toBe(0)
    expect(printoutPageCount(1)).toBe(1)
    expect(printoutPageCount(9)).toBe(1)
    expect(printoutPageCount(10)).toBe(2)
  })
})
