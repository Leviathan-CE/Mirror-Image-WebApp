import { describe, expect, it } from "vitest"

import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckCardEntry, DeckDetail } from "@/lib/api/decks"
import { deckEntry } from "@/test/deckEntry.fixture"
import type { ResourceColor } from "@/components/Playtester/session/accumulateResources.logic"
import {
  libraryDeckEntries,
  setupOpeningSession,
  spawnGroupedStockpileResources,
  startingLifeFromPilot,
  startingResourceColorsFromPilot,
  victoryNumberFromPilot,
  guestMayPlaceholderDeal,
  guestPlaceholderCoverageImproved,
  hostOpeningMayCommit,
  mergeOpeningStockpilePips,
  neededResourceColorsFromDecks,
  openingTimCoverage,
  missingStartingResourceColors,
  observeOpeningFilledCounts,
  unfilledOpeningColors,
} from "@/components/Playtester/session/setupOpeningSession.logic"

function pilot(overrides: Parameters<typeof deckEntry>[0] = {}): DeckCardEntry {
  return deckEntry({
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
  })
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
    has_invoke_cost: cost.length > 0,
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

function card(overrides: Parameters<typeof deckEntry>[0]): DeckCardEntry {
  return pilot({ quantity: 1, ...overrides })
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

describe("setupOpeningSession objectives", () => {
  const noResources = new Map<ResourceColor, CardLibraryItem>()
  const withObjectives = { includeObjectives: true as const }

  it("spawns objectives by default while SHOW_DECK_OBJECTIVE_SLOT is on", () => {
    const session = setupOpeningSession(deckWithAugments(), noResources)
    expect(session.filter((c) => c.isObjective || c.isAugment)).toHaveLength(2)
  })

  it("omits objectives when includeObjectives is false", () => {
    const session = setupOpeningSession(deckWithAugments(), noResources, "p1", {
      includeObjectives: false,
    })
    expect(session.filter((c) => c.isObjective || c.isAugment)).toHaveLength(0)
  })

  it("flags objectives so the shared field can pin them to each owner's stockpile edge", () => {
    const session = setupOpeningSession(
      deckWithAugments(),
      noResources,
      "p1",
      withObjectives
    )
    const objectives = session.filter((c) => c.isObjective || c.isAugment)

    expect(objectives.map((c) => c.name)).toEqual(["Ocular Rig", "Spinal Tap"])
    expect(objectives.every((c) => c.zone === "battlefield")).toBe(true)
    // Viewer-relative y is applied at render. Storing a y here would put both
    // seats' objectives on the same edge of the one shared field.
    expect(objectives.every((c) => c.x === undefined && c.y === undefined)).toBe(
      true
    )
  })

  it("gives both seats their own objective instances", () => {
    const p1 = setupOpeningSession(
      deckWithAugments(),
      noResources,
      "p1",
      withObjectives
    )
    const p2 = setupOpeningSession(
      deckWithAugments(),
      noResources,
      "p2",
      withObjectives
    )
    const ids = new Set([
      ...p1.filter((c) => c.isObjective || c.isAugment).map((c) => c.instanceId),
      ...p2.filter((c) => c.isObjective || c.isAugment).map((c) => c.instanceId),
    ])

    expect(ids.size).toBe(4)
    expect(
      p1.filter((c) => c.isObjective || c.isAugment).every((c) => c.owner === "p1")
    ).toBe(true)
    expect(
      p2.filter((c) => c.isObjective || c.isAugment).every((c) => c.owner === "p2")
    ).toBe(true)
  })

  it("keeps objectives and the pilot out of the shuffled library", () => {
    const session = setupOpeningSession(
      deckWithAugments(),
      noResources,
      "p1",
      withObjectives
    )
    const drawable = session.filter(
      (c) => c.zone === "library" || c.zone === "hand"
    )

    expect(drawable.map((c) => c.name)).toEqual(["Street Runner"])
    expect(session.filter((c) => c.isObjective || c.isAugment)).toHaveLength(2)
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

  it("reads tim_capacity when time_capacity is omitted", () => {
    const colors = startingResourceColorsFromPilot(
      pilot({
        time_capacity: 0,
        card: { tim_capacity: 2 } as never,
      })
    )
    expect(colors.filter((c) => c === "TIM")).toHaveLength(2)
  })
})

describe("neededResourceColorsFromDecks", () => {
  it("unions unique starting colours from both seated decks", () => {
    const asDeck = (time: number, steel: number): DeckDetail => ({
      id: time,
      name: "d",
      description: null,
      is_public: true,
      author_name: "a",
      cover_image_path: null,
      card_count: 1,
      categories: [{ id: 1, name: "Pilot", sort_order: -1, in_deck: false }],
      cards: [
        pilot({
          time_capacity: time,
          steel_capacity: steel,
          card_id: 1,
          category_id: 1,
        }),
      ],
    })
    expect(neededResourceColorsFromDecks([asDeck(1, 0), asDeck(0, 1)]).sort()).toEqual(
      ["STL", "TIM"]
    )
  })
})

describe("startingLifeFromPilot", () => {
  it("uses lif_capacity and floors at 0", () => {
    expect(startingLifeFromPilot(pilot({ lif_capacity: 20 }))).toBe(20)
    expect(startingLifeFromPilot(pilot({ lif_capacity: -3 }))).toBe(0)
    expect(startingLifeFromPilot(null)).toBe(0)
  })
})

describe("victoryNumberFromPilot", () => {
  it("uses the printed pilot number (lif_capacity until vp_capacity exists)", () => {
    expect(victoryNumberFromPilot(pilot({ lif_capacity: 12 }))).toBe(12)
    expect(victoryNumberFromPilot(null)).toBe(0)
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
        pilot({ time_capacity: 1, hand_size: 0, card_id: 1, category_id: 1, quantity: 1 }),
        pilot({
          card_id: 2,
          card_name: "Runner",
          category_id: 2,
          category_name: "Entity",
          quantity: 1,
          time_capacity: undefined,
          hand_size: undefined,
        }),
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
        pilot({ card_id: 1, category_id: 1, quantity: 1 }),
        pilot({
          card_id: 2,
          card_name: "Drone",
          category_id: 2,
          category_name: "Entity",
          quantity: 2,
        }),
        pilot({
          card_id: 3,
          card_name: "Spare",
          category_id: 3,
          category_name: "Maybe",
          quantity: 1,
        }),
      ],
    }
    expect(libraryDeckEntries(deck).map((card) => card.card.id)).toEqual([2])
  })
})

describe("guestMayPlaceholderDeal", () => {
  it("waits for the resource catalogue before dealing", () => {
    expect(
      guestMayPlaceholderDeal({
        hasFog: false,
        resourcesReady: false,
        alreadyDealt: false,
      })
    ).toBe(false)
  })

  it("deals once resources are ready if host fog has not arrived", () => {
    expect(
      guestMayPlaceholderDeal({
        hasFog: false,
        resourcesReady: true,
        alreadyDealt: false,
      })
    ).toBe(true)
  })

  it("does not re-deal after fog or a prior placeholder", () => {
    expect(
      guestMayPlaceholderDeal({
        hasFog: true,
        resourcesReady: true,
        alreadyDealt: false,
      })
    ).toBe(false)
    expect(
      guestMayPlaceholderDeal({
        hasFog: false,
        resourcesReady: true,
        alreadyDealt: true,
      })
    ).toBe(false)
  })

  it("rebuilds the placeholder when coverage improves before fog", () => {
    expect(
      guestMayPlaceholderDeal({
        hasFog: false,
        resourcesReady: true,
        alreadyDealt: true,
        coverageImproved: true,
      })
    ).toBe(true)
    expect(
      guestMayPlaceholderDeal({
        hasFog: true,
        resourcesReady: true,
        alreadyDealt: true,
        coverageImproved: true,
      })
    ).toBe(false)
  })
})

describe("opening TIM coverage probe", () => {
  it("reads the three room-deal facts without using a card name", () => {
    const mapWithTim = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
    ])
    expect(
      openingTimCoverage({
        requestedColors: ["LIF"],
        resourceByColor: mapWithTim,
        stockpile: [],
      })
    ).toEqual({
      pilotAsksTim: false,
      mapHasTim: true,
      stockpileTimCount: 0,
    })
    expect(
      openingTimCoverage({
        requestedColors: ["TIM"],
        resourceByColor: new Map(),
        stockpile: [],
      })
    ).toEqual({
      pilotAsksTim: true,
      mapHasTim: false,
      stockpileTimCount: 0,
    })
    const spawned = spawnGroupedStockpileResources(
      ["TIM", "TIM"],
      mapWithTim
    )
    expect(
      openingTimCoverage({
        requestedColors: ["TIM"],
        resourceByColor: mapWithTim,
        stockpile: spawned,
      })
    ).toEqual({
      pilotAsksTim: true,
      mapHasTim: true,
      stockpileTimCount: 2,
    })
  })
})

describe("guestPlaceholderCoverageImproved", () => {
  it("is true when the map gains TIM the placeholder skipped", () => {
    const mapWithTim = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
    ])
    expect(
      guestPlaceholderCoverageImproved({
        needed: ["TIM", "STL"],
        resourceByColor: mapWithTim,
        filledCounts: new Map([["STL", 1]]),
      })
    ).toBe(true)
    expect(
      guestPlaceholderCoverageImproved({
        needed: ["TIM"],
        resourceByColor: mapWithTim,
        filledCounts: new Map([["TIM", 1]]),
      })
    ).toBe(false)
  })

  it("stays false after a starting pip was issued then deleted", () => {
    const mapWithTim = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
    ])
    expect(
      guestPlaceholderCoverageImproved({
        needed: ["TIM"],
        resourceByColor: mapWithTim,
        filledCounts: new Map([["TIM", 1]]),
      })
    ).toBe(false)
  })
})

describe("missingStartingResourceColors", () => {
  it("lists TIM when generate can spawn it but opening skipped it", () => {
    const mapWithTim = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
      ["LIF", resource(2, "Spirit Power", ["LIF"])],
    ])
    expect(
      missingStartingResourceColors({
        needed: ["LIF", "TIM"],
        resourceByColor: mapWithTim,
        stockpile: spawnGroupedStockpileResources(["LIF"], mapWithTim),
      })
    ).toEqual(["TIM"])
    expect(
      missingStartingResourceColors({
        needed: ["LIF", "TIM"],
        resourceByColor: mapWithTim,
        stockpile: spawnGroupedStockpileResources(["LIF", "TIM"], mapWithTim),
      })
    ).toEqual([])
  })
})

describe("unfilledOpeningColors", () => {
  it("does not re-issue a starting pip after it was already filled", () => {
    const mapWithTim = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
      ["LIF", resource(2, "Spirit Power", ["LIF"])],
    ])
    expect(
      unfilledOpeningColors({
        needed: ["LIF", "TIM"],
        resourceByColor: mapWithTim,
        filledCounts: new Map([
          ["LIF", 1],
          ["TIM", 1],
        ]),
      })
    ).toEqual([])
  })

  it("issues TIM when the map later covers a pip opening never filled", () => {
    const mapWithTim = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
      ["LIF", resource(2, "Spirit Power", ["LIF"])],
    ])
    expect(
      unfilledOpeningColors({
        needed: ["LIF", "TIM"],
        resourceByColor: mapWithTim,
        filledCounts: new Map([["LIF", 1]]),
      })
    ).toEqual(["TIM"])
  })
})

describe("observeOpeningFilledCounts", () => {
  it("keeps the issued count when the stockpile is emptied", () => {
    const mapWithTim = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
    ])
    const issued = observeOpeningFilledCounts(
      new Map(),
      spawnGroupedStockpileResources(["TIM"], mapWithTim)
    )
    expect(issued.get("TIM")).toBe(1)
    expect(observeOpeningFilledCounts(issued, []).get("TIM")).toBe(1)
  })
})

describe("hostOpeningMayCommit", () => {
  it("waits for the opponent deck, not for every pip to be in the map", () => {
    expect(
      hostOpeningMayCommit({
        resourcesReady: false,
        hasOpponentDeck: true,
        requiresOpponentDeck: true,
      })
    ).toBe(false)
    expect(
      hostOpeningMayCommit({
        resourcesReady: true,
        hasOpponentDeck: false,
        requiresOpponentDeck: true,
      })
    ).toBe(false)
    expect(
      hostOpeningMayCommit({
        resourcesReady: true,
        hasOpponentDeck: true,
        requiresOpponentDeck: true,
      })
    ).toBe(true)
  })

  it("keeps guest TIM on seq-0 fog that omitted that pip", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["LIF", resource(9, "Life", ["LIF"])],
      ["TIM", resource(10, "Time Token", ["TIM"])],
    ])
    const placeholder = spawnGroupedStockpileResources(
      ["LIF", "TIM"],
      byColor,
      0,
      "p2"
    )
    const fogOnlyLife = spawnGroupedStockpileResources(["LIF"], byColor, 0, "p2")
    const merged = mergeOpeningStockpilePips({
      seq: 0,
      owner: "p2",
      incoming: fogOnlyLife,
      previous: placeholder,
    })
    const coverage = openingTimCoverage({
      requestedColors: ["LIF", "TIM"],
      resourceByColor: byColor,
      stockpile: merged,
    })
    expect(coverage.stockpileTimCount).toBe(1)
    const fogLife = fogOnlyLife[0]
    const keptTim = merged.find((card) =>
      (card.cost ?? []).some((pip) => pip.trim().toUpperCase() === "TIM")
    )
    expect(fogLife.x).toBeUndefined()
    expect(keptTim?.x).toEqual(expect.any(Number))
    expect(keptTim?.y).toEqual(expect.any(Number))
  })

  it("does not keep placeholder pips after the opening seq", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
    ])
    const placeholder = spawnGroupedStockpileResources(["TIM"], byColor, 0, "p2")
    const later = spawnGroupedStockpileResources([], byColor, 0, "p2")
    expect(
      mergeOpeningStockpilePips({
        seq: 1,
        owner: "p2",
        incoming: later,
        previous: placeholder,
      })
    ).toEqual(later)
  })

  it("keeps TIM on a two-seat opening when the map covers TIM", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resource(10, "Time Token", ["TIM"])],
      ["STL", resource(11, "Steel", ["GEN"])],
    ])
    const p1 = spawnGroupedStockpileResources(["TIM", "STL"], byColor, 0, "p1")
    const p2 = spawnGroupedStockpileResources(["TIM", "STL"], byColor, 0, "p2")
    const opening = [...p1, ...p2]
    expect(
      openingTimCoverage({
        requestedColors: ["TIM", "STL"],
        resourceByColor: byColor,
        stockpile: opening.filter((c) => c.owner === "p1"),
      }).stockpileTimCount
    ).toBe(1)
    expect(
      openingTimCoverage({
        requestedColors: ["TIM", "STL"],
        resourceByColor: byColor,
        stockpile: opening.filter((c) => c.owner === "p2"),
      }).stockpileTimCount
    ).toBe(1)
  })
})
