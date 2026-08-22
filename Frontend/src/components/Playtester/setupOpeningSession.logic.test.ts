import { describe, expect, it } from "vitest"

import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckCardEntry, DeckDetail } from "@/lib/api/decks"
import type { ResourceColor } from "@/components/Playtester/accumulateResources.logic"
import {
  libraryDeckEntries,
  setupOpeningSession,
  spawnGroupedStockpileResources,
  startingLifeFromPilot,
  startingResourceColorsFromPilot,
} from "@/components/Playtester/setupOpeningSession.logic"

function pilot(overrides: Partial<DeckCardEntry> = {}): DeckCardEntry {
  return {
    card_id: 1,
    card_name: "Evran",
    quantity: 1,
    category_id: 1,
    category_name: "Pilot",
    sort_order: 0,
    card_art_path: null,
    cost: [],
    ram_capacity: 0,
    power_capacity: 0,
    metal_capacity: 0,
    spirit_capacity: 0,
    steel_capacity: 0,
    time_capacity: 0,
    lif_capacity: 0,
    hand_size: 0,
    ...overrides,
  }
}

function resource(
  id: number,
  name: string,
  cost: string[]
): CardLibraryItem {
  return {
    id,
    card_name: name,
    card_set_name: "set",
    rarity: "common",
    invoke_cost: 0,
    cost,
    super_types: ["Resource"],
    sub_types: [],
    types_line: "",
    description: "",
    keywords: [],
    show_help_text: true,
    threat_level: "0",
    card_art_path: null,
  }
}

function card(overrides: Partial<DeckCardEntry>): DeckCardEntry {
  return { ...pilot(), quantity: 1, ...overrides }
}

/** Pilot in category 1, two augments in category 2, one main card in 3. */
function deckWithAugments(): DeckDetail {
  return {
    id: 7,
    name: "Starter",
    description: null,
    is_public: false,
    author_name: "tester",
    cover_image_path: null,
    card_count: 4,
    categories: [
      { id: 1, name: "Pilot", sort_order: 0 },
      { id: 2, name: "Augments", sort_order: 1 },
      { id: 3, name: "Main", sort_order: 2 },
    ],
    cards: [
      card({ card_id: 1, card_name: "Evran", category_id: 1, hand_size: 1 }),
      card({ card_id: 2, card_name: "Ocular Rig", category_id: 2 }),
      card({ card_id: 3, card_name: "Spinal Tap", category_id: 2 }),
      card({ card_id: 4, card_name: "Street Runner", category_id: 3 }),
    ],
  }
}

describe("setupOpeningSession augments", () => {
  const noResources = new Map<ResourceColor, CardLibraryItem>()

  it("flags augments so the shared field can pin them to each owner's stockpile edge", () => {
    const session = setupOpeningSession(deckWithAugments(), noResources)
    const augments = session.filter((c) => c.isAugment)

    expect(augments.map((c) => c.name)).toEqual(["Ocular Rig", "Spinal Tap"])
    expect(augments.every((c) => c.zone === "battlefield")).toBe(true)
    // Viewer-relative y is applied at render. Storing a y here would put both
    // seats' augments on the same edge of the one shared field.
    expect(augments.every((c) => c.x === undefined && c.y === undefined)).toBe(
      true
    )
  })

  it("gives both seats their own augment instances", () => {
    const p1 = setupOpeningSession(deckWithAugments(), noResources, "p1")
    const p2 = setupOpeningSession(deckWithAugments(), noResources, "p2")
    const ids = new Set([
      ...p1.filter((c) => c.isAugment).map((c) => c.instanceId),
      ...p2.filter((c) => c.isAugment).map((c) => c.instanceId),
    ])

    expect(ids.size).toBe(4)
    expect(p1.filter((c) => c.isAugment).every((c) => c.owner === "p1")).toBe(
      true
    )
    expect(p2.filter((c) => c.isAugment).every((c) => c.owner === "p2")).toBe(
      true
    )
  })

  it("keeps augments and the pilot out of the shuffled library", () => {
    const session = setupOpeningSession(deckWithAugments(), noResources)
    const drawable = session.filter(
      (c) => c.zone === "library" || c.zone === "hand"
    )

    expect(drawable.map((c) => c.name)).toEqual(["Street Runner"])
    expect(session.filter((c) => c.isAugment)).toHaveLength(2)
  })
})

describe("startingResourceColorsFromPilot", () => {
  it("emits TIM pips from time_capacity (and other colours)", () => {
    const colors = startingResourceColorsFromPilot(
      pilot({
        ram_capacity: 1,
        time_capacity: 2,
        steel_capacity: 1,
        spirit_capacity: 1,
      })
    )
    expect(colors.filter((c) => c === "TIM")).toHaveLength(2)
    expect(colors.filter((c) => c === "RAM")).toHaveLength(1)
    expect(colors.filter((c) => c === "STL")).toHaveLength(1)
    expect(colors.filter((c) => c === "LIF")).toHaveLength(1)
  })
})

describe("startingLifeFromPilot", () => {
  it("uses lif_capacity and floors at 0", () => {
    expect(startingLifeFromPilot(pilot({ lif_capacity: 20 }))).toBe(20)
    expect(startingLifeFromPilot(pilot({ lif_capacity: -3 }))).toBe(0)
    expect(startingLifeFromPilot(null)).toBe(0)
  })
})

describe("spawnGroupedStockpileResources", () => {
  it("spawns TIM when the catalogue map has Natural Time", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Natural Time", ["TIM"])],
      ["STL", resource(11, "Steel", ["GEN"])],
    ])
    const spawned = spawnGroupedStockpileResources(["TIM", "TIM", "STL"], byColor)
    expect(spawned).toHaveLength(3)
    expect(spawned.filter((c) => c.name === "Natural Time")).toHaveLength(2)
    expect(spawned.filter((c) => c.name === "Steel")).toHaveLength(1)
    expect(spawned.every((c) => c.isToken && c.zone === "stockpile")).toBe(
      true
    )
    expect(spawned.every((c) => c.owner === "p1")).toBe(true)
  })

  it("skips colours missing from the catalogue map", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["STL", resource(11, "Steel", ["GEN"])],
    ])
    const spawned = spawnGroupedStockpileResources(["TIM", "STL"], byColor)
    expect(spawned).toHaveLength(1)
    expect(spawned[0]?.name).toBe("Steel")
  })

  it("gives each seat unique instance ids (same template/seq must not collide)", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Natural Time", ["TIM"])],
    ])
    const p1 = spawnGroupedStockpileResources(["TIM", "TIM"], byColor, 0, "p1")
    const p2 = spawnGroupedStockpileResources(["TIM", "TIM"], byColor, 0, "p2")
    const ids = new Set([...p1, ...p2].map((c) => c.instanceId))
    expect(ids.size).toBe(4)
  })

  it("keeps owner stamps when both seats are merged into one session list", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Natural Time", ["TIM"])],
      ["STL", resource(11, "Steel", ["GEN"])],
    ])
    const opening = [
      ...spawnGroupedStockpileResources(["TIM", "STL"], byColor, 0, "p1"),
      ...spawnGroupedStockpileResources(["TIM", "STL"], byColor, 0, "p2"),
    ]
    expect(opening).toHaveLength(4)
    expect(new Set(opening.map((c) => c.instanceId)).size).toBe(4)
    expect(opening.filter((c) => c.owner === "p1")).toHaveLength(2)
    expect(opening.filter((c) => c.owner === "p2")).toHaveLength(2)
  })
})

describe("stampStockpileWorldHomes via setupOpeningSession", () => {
  it("puts p1 resources lower on the mat than p2 (world = p1 view)", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Natural Time", ["TIM"])],
    ])
    // Use full setup so world homes are stamped.
    const deck = (name: string): DeckDetail => ({
      id: 1,
      name,
      description: null,
      is_public: true,
      author_name: "a",
      cover_image_path: null,
      card_count: 1,
      categories: [
        { id: 1, name: "Pilot", sort_order: -1, in_deck: false },
        { id: 2, name: "Entity", sort_order: 0, in_deck: true },
      ],
      cards: [
        {
          ...pilot({ time_capacity: 1, hand_size: 0 }),
          card_id: 1,
          category_id: 1,
          quantity: 1,
        },
        {
          ...pilot(),
          card_id: 2,
          card_name: "Runner",
          category_id: 2,
          category_name: "Entity",
          quantity: 1,
          time_capacity: undefined,
          hand_size: undefined,
        },
      ],
    })
    const p1 = setupOpeningSession(deck("A"), byColor, "p1").filter(
      (c) => c.isToken
    )
    const p2 = setupOpeningSession(deck("B"), byColor, "p2").filter(
      (c) => c.isToken
    )
    expect(p1[0]?.y).toBeTypeOf("number")
    expect(p2[0]?.y).toBeTypeOf("number")
    expect(p1[0]!.y!).toBeGreaterThan(p2[0]!.y!)
    expect(p1[0]?.owner).toBe("p1")
    expect(p2[0]?.owner).toBe("p2")
  })
})

describe("libraryDeckEntries", () => {
  it("omits reserved and list-only sections from the RIG", () => {
    const deck: DeckDetail = {
      id: 1,
      name: "Test",
      description: null,
      is_public: true,
      author_name: "a",
      cover_image_path: null,
      card_count: 3,
      categories: [
        { id: 1, name: "Pilot", sort_order: -1, in_deck: false },
        { id: 2, name: "Entity", sort_order: 0, in_deck: true },
        { id: 3, name: "Maybe", sort_order: 1, in_deck: false },
      ],
      cards: [
        { ...pilot(), card_id: 1, category_id: 1, quantity: 1 },
        {
          ...pilot(),
          card_id: 2,
          card_name: "Drone",
          category_id: 2,
          category_name: "Entity",
          quantity: 2,
        },
        {
          ...pilot(),
          card_id: 3,
          card_name: "Spare",
          category_id: 3,
          category_name: "Maybe",
          quantity: 1,
        },
      ],
    }
    expect(libraryDeckEntries(deck).map((card) => card.card_id)).toEqual([2])
  })
})
