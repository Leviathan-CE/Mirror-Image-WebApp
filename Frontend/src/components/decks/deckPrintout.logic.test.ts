import { describe, expect, it } from "vitest"

import { collectDeckPrintoutSlots } from "@/components/decks/deckPrintout.logic"
import type { DeckCardEntry, DeckCategoryOut, DeckDetail } from "@/lib/api/decks"

function category(
  id: number,
  name: string,
  sort_order: number,
  in_deck = true
): DeckCategoryOut {
  return { id, name, sort_order, in_deck }
}

function card(
  overrides: Partial<DeckCardEntry> & Pick<DeckCardEntry, "card_id" | "category_id">
): DeckCardEntry {
  return {
    card_name: `Card ${overrides.card_id}`,
    quantity: 1,
    category_name: "Entity",
    sort_order: 0,
    card_art_path: "/media/test.png",
    ...overrides,
  }
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

describe("collectDeckPrintoutSlots", () => {
  it("includes pilot, augments, and in-deck main rows expanded by quantity", () => {
    const categories = [
      category(1, "Pilot", -1),
      category(2, "Augments", -2),
      category(3, "Entity", 0, true),
      category(4, "Sideboard", 1, false),
    ]
    const cards = [
      card({ card_id: 10, category_id: 1, card_name: "My Pilot" }),
      card({ card_id: 20, category_id: 2, card_name: "Aug A", quantity: 1 }),
      card({ card_id: 30, category_id: 3, card_name: "Unit", quantity: 2 }),
      card({ card_id: 40, category_id: 4, card_name: "Side", quantity: 3 }),
    ]

    const slots = collectDeckPrintoutSlots(deck(categories, cards))
    expect(slots.map((s) => s.card_name)).toEqual([
      "My Pilot",
      "Aug A",
      "Unit",
      "Unit",
    ])
    expect(slots[0]?.section).toBe("pilot")
    expect(slots[1]?.section).toBe("augment")
    expect(slots[2]?.section).toBe("deck")
  })
})
