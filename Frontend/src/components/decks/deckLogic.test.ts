import { describe, expect, it } from "vitest"

import { DECK_CARD_MAX_COPIES } from "./DeckCardStack"
import {
  applyCardMove,
  augmentCards,
  canAddCopyToMain,
  cardsByCategory,
  clampQuantityToMax,
  deckCardCount,
  isAugmentCategory,
  isPilotCategory,
  isReservedCategory,
  mainCategoryId,
  maxCopiesForCategory,
  nextCardQuantity,
  nextNewSectionName,
  orderedSelectionKeys,
  pilotCard,
  removeCardEntry,
  selectionRangeKeys,
  sortDeckCards,
  toggleSelectionKey,
  withCardEntry,
} from "./deckLogic"
import type { DeckCardEntry, DeckCategoryOut, DeckDetail } from "@/lib/api/decks"

function cat(
  id: number,
  name: string,
  sort_order = id
): DeckCategoryOut {
  return { id, name, sort_order }
}

function card(
  overrides: Partial<DeckCardEntry> &
    Pick<DeckCardEntry, "card_id" | "category_id">
): DeckCardEntry {
  return {
    card_name: overrides.card_name ?? `Card ${overrides.card_id}`,
    quantity: overrides.quantity ?? 1,
    category_name: overrides.category_name ?? "Main",
    sort_order: overrides.sort_order ?? 0,
    card_art_path: overrides.card_art_path ?? null,
    invoke_cost: overrides.invoke_cost,
    types_line: overrides.types_line,
    card_art_version: overrides.card_art_version,
    ...overrides,
  }
}

describe("reserved categories", () => {
  it("detects pilot and augment by name (case-insensitive)", () => {
    expect(isPilotCategory(cat(1, "Pilot"))).toBe(true)
    expect(isPilotCategory(cat(1, " pilot "))).toBe(true)
    expect(isAugmentCategory(cat(2, "Augments"))).toBe(true)
    expect(isReservedCategory(cat(1, "Pilot"))).toBe(true)
    expect(isReservedCategory(cat(3, "Main"))).toBe(false)
  })
})

describe("sortDeckCards", () => {
  const cards = [
    card({
      card_id: 1,
      category_id: 1,
      card_name: "Zebra",
      invoke_cost: 3,
      types_line: "Entity",
    }),
    card({
      card_id: 2,
      category_id: 1,
      card_name: "Alpha",
      invoke_cost: 1,
      types_line: "Cyberspell",
    }),
    card({
      card_id: 3,
      category_id: 1,
      card_name: "Beta",
      invoke_cost: 1,
      types_line: "Entity",
    }),
  ]

  it("sorts by name", () => {
    expect(sortDeckCards(cards, "name").map((c) => c.card_name)).toEqual([
      "Alpha",
      "Beta",
      "Zebra",
    ])
  })

  it("sorts by invoke cost then name", () => {
    expect(sortDeckCards(cards, "invoke").map((c) => c.card_id)).toEqual([
      2, 3, 1,
    ])
  })

  it("sorts by type then name", () => {
    expect(sortDeckCards(cards, "type").map((c) => c.card_id)).toEqual([
      2, 3, 1,
    ])
  })
})

describe("cardsByCategory", () => {
  it("omits reserved sections and groups remaining cards", () => {
    const categories = [
      cat(1, "Pilot", -2),
      cat(2, "Augments", -1),
      cat(3, "Main", 0),
      cat(4, "Side", 1),
    ]
    const cards = [
      card({ card_id: 10, category_id: 1 }),
      card({ card_id: 20, category_id: 3, card_name: "B" }),
      card({ card_id: 21, category_id: 3, card_name: "A" }),
      card({ card_id: 30, category_id: 4 }),
    ]
    const groups = cardsByCategory(cards, categories, "name")
    expect(groups.map((g) => g.category.name)).toEqual(["Main", "Side"])
    expect(groups[0].cards.map((c) => c.card_id)).toEqual([21, 20])
  })
})

describe("mainCategoryId", () => {
  it("prefers Main when present", () => {
    expect(mainCategoryId([cat(9, "Side", 0), cat(3, "Main", 1)])).toBe(3)
  })

  it("falls back to first playable by sort_order", () => {
    expect(
      mainCategoryId([
        cat(1, "Pilot", -1),
        cat(5, "Side", 2),
        cat(4, "Extra", 1),
      ])
    ).toBe(4)
  })

  it("returns null when only reserved categories exist", () => {
    expect(mainCategoryId([cat(1, "Pilot"), cat(2, "Augments")])).toBeNull()
  })
})

describe("pilotCard / augmentCards", () => {
  const categories = [cat(1, "Pilot"), cat(2, "Augments"), cat(3, "Main")]
  const cards = [
    card({ card_id: 99, category_id: 1, card_name: "Diana" }),
    card({
      card_id: 50,
      category_id: 2,
      card_name: "Rifle",
      types_line: "Augment",
    }),
    card({ card_id: 1, category_id: 3 }),
  ]

  it("finds the pilot card", () => {
    expect(pilotCard(cards, categories)?.card_id).toBe(99)
  })

  it("returns augment cards only", () => {
    expect(
      augmentCards(cards, categories, "name").map((c) => c.card_id)
    ).toEqual([50])
  })
})

describe("withCardEntry / applyCardMove", () => {
  it("upserts an entry and recalculates card_count", () => {
    const prev: DeckDetail = {
      id: 2,
      name: "Test",
      description: null,
      is_public: false,
      author_name: "user",
      cover_image_path: null,
      card_count: 2,
      categories: [cat(1, "Main")],
      cards: [card({ card_id: 1, category_id: 1, quantity: 2 })],
    }
    const next = withCardEntry(
      prev,
      card({ card_id: 1, category_id: 1, quantity: 3 })
    )
    expect(next.cards).toHaveLength(1)
    expect(next.cards[0].quantity).toBe(3)
    expect(next.card_count).toBe(3)
  })

  it("moves a card between categories in a working list", () => {
    const working = [
      card({ card_id: 1, category_id: 10, quantity: 2 }),
      card({ card_id: 2, category_id: 10, quantity: 1 }),
    ]
    const updated = card({ card_id: 1, category_id: 20, quantity: 2 })
    const next = applyCardMove(working, 10, updated)
    expect(next.map((c) => `${c.category_id}:${c.card_id}`)).toEqual([
      "10:2",
      "20:1",
    ])
    expect(deckCardCount(next)).toBe(3)
  })

  it("removes a card entry by id+category", () => {
    const cards = [
      card({ card_id: 1, category_id: 1 }),
      card({ card_id: 1, category_id: 2 }),
    ]
    expect(removeCardEntry(cards, 1, 1)).toEqual([
      card({ card_id: 1, category_id: 2 }),
    ])
  })
})

describe("quantity rules", () => {
  it("allows up to 3 copies in normal sections", () => {
    expect(maxCopiesForCategory(cat(1, "Main"))).toBe(DECK_CARD_MAX_COPIES)
    expect(nextCardQuantity(2, 1, DECK_CARD_MAX_COPIES)).toBe(3)
    expect(nextCardQuantity(3, 1, DECK_CARD_MAX_COPIES)).toBeNull()
  })

  it("limits augments to 1 copy", () => {
    expect(maxCopiesForCategory(cat(2, "Augments"))).toBe(1)
    expect(nextCardQuantity(1, 1, 1)).toBeNull()
  })

  it("returns 0 when decrementing the last copy", () => {
    expect(nextCardQuantity(1, -1, DECK_CARD_MAX_COPIES)).toBe(0)
  })

  it("canAddCopyToMain blocks at max", () => {
    expect(canAddCopyToMain(3).ok).toBe(false)
    expect(canAddCopyToMain(2).ok).toBe(true)
  })

  it("clamps quantity to max copies", () => {
    expect(clampQuantityToMax(5)).toBe(3)
    expect(clampQuantityToMax(2)).toBe(2)
  })
})

describe("nextNewSectionName", () => {
  it("starts at New Section then increments", () => {
    expect(nextNewSectionName([])).toBe("New Section")
    expect(nextNewSectionName(["New Section"])).toBe("New Section 2")
    expect(nextNewSectionName(["new section", "New Section 2"])).toBe(
      "New Section 3"
    )
  })
})

describe("selection helpers", () => {
  it("toggles keys in a set", () => {
    const once = toggleSelectionKey(new Set(["1:1"]), "2:2")
    expect([...once].sort()).toEqual(["1:1", "2:2"])
    const twice = toggleSelectionKey(once, "1:1")
    expect([...twice]).toEqual(["2:2"])
  })

  it("builds an inclusive range between anchor and target", () => {
    const keys = ["a", "b", "c", "d"]
    expect(selectionRangeKeys(keys, "b", "d")).toEqual(["b", "c", "d"])
    expect(selectionRangeKeys(keys, "d", "b")).toEqual(["b", "c", "d"])
  })

  it("falls back to the target when anchor is missing", () => {
    expect(selectionRangeKeys(["a", "b"], null, "b")).toEqual(["b"])
  })

  it("orders selection keys as augments then playable sections", () => {
    const categories = [
      cat(1, "Pilot", -2),
      cat(2, "Augments", -1),
      cat(3, "Main", 0),
    ]
    const cards = [
      card({ card_id: 2, category_id: 3, card_name: "B" }),
      card({ card_id: 1, category_id: 3, card_name: "A" }),
      card({ card_id: 9, category_id: 2, card_name: "Aug" }),
      card({ card_id: 5, category_id: 1, card_name: "Pilot" }),
    ]
    expect(orderedSelectionKeys(cards, categories, "name")).toEqual([
      "2:9",
      "3:1",
      "3:2",
    ])
  })
})
