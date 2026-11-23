import { describe, expect, it } from "vitest"

import { deckEntry } from "@/test/deckEntry.fixture"
import type { DeckCategoryOut, DeckDetail } from "@/lib/api/decks"
import {
  buildDeckStats,
  cardsSeen,
  deckOutTurn,
  drawReport,
  hypergeometricAtLeastOne,
  payPlanForCost,
  playTurnForRate,
  resourceNeed,
  startingStockpileForSeat,
  targetCard,
  timeWaitQuantity,
} from "./deckStats.logic"

function cat(
  id: number,
  name: string,
  in_deck = true
): DeckCategoryOut {
  return { id, name, sort_order: id, in_deck }
}

function detail(
  categories: DeckCategoryOut[],
  cards: DeckDetail["cards"]
): DeckDetail {
  return {
    id: 1,
    name: "Test",
    description: null,
    is_public: false,
    author_name: "tester",
    cover_image_path: null,
    card_count: cards.length,
    categories,
    cards,
  }
}

describe("draw odds", () => {
  it("matches the 4-of opening hand chance", () => {
    const chance = hypergeometricAtLeastOne(40, 4, 5)
    expect(chance).toBeCloseTo(1 - 376992 / 658008, 5)
  })

  it("sees the opening hand, then one card each later turn", () => {
    expect(cardsSeen(5, 1, "first")).toBe(5)
    expect(cardsSeen(5, 3, "first")).toBe(7)
    expect(cardsSeen(5, 1, "second")).toBe(6)
  })
})

describe("deck clock", () => {
  it("fails the empty draw on the printed turns", () => {
    const remaining = 40 - 5
    expect(deckOutTurn(remaining, 1, "first")).toBe(37)
    expect(deckOutTurn(remaining, 2, "first")).toBe(19)
    expect(deckOutTurn(remaining, 1, "second")).toBe(36)
  })
})

describe("buildDeckStats", () => {
  const categories = [
    cat(1, "Pilot", false),
    cat(2, "Entity"),
    cat(3, "Objective/Augments", false),
  ]

  it("keeps pilot and objectives out of the curve", () => {
    const stats = buildDeckStats(
      detail(categories, [
        deckEntry({
          card_id: 1,
          category_id: 1,
          card_name: "Pilot",
          is_pilot: true,
          hand_size: 5,
          spirit_capacity: 2,
          has_invoke_cost: true,
          invoke_cost: 0,
        }),
        deckEntry({
          card_id: 2,
          category_id: 2,
          quantity: 2,
          card_name: "Bolt",
          has_invoke_cost: true,
          invoke_cost: 1,
          cost: ["LIF"],
          super_types: ["Unit"],
          has_tlv: true,
          threat_level: "3|2",
          keywords: ["Blitz"],
        }),
        deckEntry({
          card_id: 3,
          category_id: 2,
          card_name: "Hidden",
          has_invoke_cost: false,
          invoke_cost: 9,
        }),
        deckEntry({
          card_id: 4,
          category_id: 3,
          card_name: "Relic",
          is_augment: false,
          super_types: ["Objective"],
        }),
      ])
    )
    expect(stats.deckSize).toBe(3)
    expect(stats.meanInvoke).toBe(1)
    expect(stats.noCost).toBe(1)
    expect(stats.handSize).toBe(5)
    expect(stats.stockpile.LIF).toBe(2)
    expect(stats.units.count).toBe(2)
    expect(stats.units.averageDamage).toBe(3)
    expect(stats.units.averageHealth).toBe(2)
    expect(
      stats.units.health.find((row) => row.name === "2")?.count
    ).toBe(2)
    expect(
      stats.units.damage.find((row) => row.name === "3")?.count
    ).toBe(2)
    expect(
      stats.units.keywords.find((row) => row.name === "Blitz")?.count
    ).toBe(2)
    expect(stats.legal.sizeOk).toBe(false)
    expect(stats.legal.pilotOk).toBe(true)
    expect(stats.legal.sideOk).toBe(false)
  })

  it("allows four augments with Extra Hard Point and one objective", () => {
    const stats = buildDeckStats(
      detail(
        [cat(3, "Objectives", false)],
        [
          deckEntry({
            card_id: 1,
            category_id: 3,
            card_name: "Goal",
            super_types: ["Objective"],
          }),
          deckEntry({
            card_id: 2,
            category_id: 3,
            card_name: "Extra Hard Point",
            is_augment: true,
            super_types: ["Augment"],
          }),
          deckEntry({
            card_id: 3,
            category_id: 3,
            quantity: 3,
            card_name: "Bolt-On",
            is_augment: true,
            super_types: ["Augment"],
          }),
        ]
      )
    )
    expect(stats.legal.objectiveCount).toBe(1)
    expect(stats.legal.augmentCount).toBe(4)
    expect(stats.legal.sideOk).toBe(true)
  })

  it("keeps the normal three-card sideboard without Extra Hard Point", () => {
    const ok = buildDeckStats(
      detail(
        [cat(3, "Objectives", false)],
        [
          deckEntry({
            card_id: 1,
            category_id: 3,
            card_name: "Goal",
            super_types: ["Objective"],
          }),
          deckEntry({
            card_id: 2,
            category_id: 3,
            quantity: 2,
            card_name: "Bolt-On",
            is_augment: true,
            super_types: ["Augment"],
          }),
        ]
      )
    )
    const tooMany = buildDeckStats(
      detail(
        [cat(3, "Objectives", false)],
        [
          deckEntry({
            card_id: 1,
            category_id: 3,
            card_name: "Goal",
            super_types: ["Objective"],
          }),
          deckEntry({
            card_id: 2,
            category_id: 3,
            quantity: 3,
            card_name: "Bolt-On",
            is_augment: true,
            super_types: ["Augment"],
          }),
        ]
      )
    )
    expect(ok.legal.sideOk).toBe(true)
    expect(tooMany.legal.sideOk).toBe(false)
  })

  it("counts every keyword, including Recursive", () => {
    const stats = buildDeckStats(
      detail([cat(2, "Entity")], [
        deckEntry({
          card_id: 1,
          category_id: 2,
          quantity: 3,
          card_name: "Loop",
          keywords: ["Recursive", "Surge"],
        }),
        deckEntry({
          card_id: 2,
          category_id: 2,
          quantity: 1,
          card_name: "Scout",
          keywords: ["Stealth:LIF"],
        }),
      ])
    )
    expect(
      stats.units.keywords.find((row) => row.name === "Recursive")
        ?.count
    ).toBe(3)
    expect(
      stats.units.keywords.find((row) => row.name === "Surge")?.count
    ).toBe(3)
    expect(
      stats.units.keywords.find((row) => row.name === "Stealth")
        ?.count
    ).toBe(1)
  })

  it("rejects a fourth copy and a second prototype", () => {
    const stats = buildDeckStats(
      detail(categories, [
        deckEntry({
          card_id: 9,
          category_id: 2,
          quantity: 4,
          card_name: "Same",
          super_types: ["Prototype"],
        }),
      ])
    )
    expect(stats.legal.copiesOk).toBe(false)
    expect(stats.legal.prototypeOk).toBe(false)
  })

  it("keeps a grey-only card out of the colored slices", () => {
    const stats = buildDeckStats(
      detail(
        [cat(2, "Entity")],
        [
          deckEntry({
            card_id: 1,
            category_id: 2,
            quantity: 3,
            card_name: "Grey",
            has_invoke_cost: true,
            invoke_cost: 2,
            cost: ["GEN2"],
          }),
          deckEntry({
            card_id: 2,
            category_id: 2,
            card_name: "Life",
            has_invoke_cost: true,
            invoke_cost: 2,
            cost: ["LIF", "GEN1"],
          }),
        ]
      )
    )
    const grey = stats.deckColors.find((row) => row.id === "GREY")
    const life = stats.deckColors.find((row) => row.id === "LIF")
    expect(grey?.count).toBe(3)
    expect(life?.count).toBe(1)
    expect(grey && life ? grey.count + life.count : 0).toBe(
      stats.deckSize
    )
  })

  it("adds a multi-color card to each of its colors", () => {
    const stats = buildDeckStats(
      detail(
        [cat(2, "Entity")],
        [
          deckEntry({
            card_id: 1,
            category_id: 2,
            quantity: 2,
            card_name: "Mix",
            has_invoke_cost: true,
            invoke_cost: 2,
            cost: ["LIF", "POW"],
          }),
        ]
      )
    )
    expect(stats.deckColors.find((row) => row.id === "LIF")?.count)
      .toBe(2)
    expect(stats.deckColors.find((row) => row.id === "POW")?.count)
      .toBe(2)
    expect(
      stats.deckColors.some((row) => row.id === "MULTI")
    ).toBe(false)
  })

  it("counts a hybrid pip apart from solid colors", () => {
    const stats = buildDeckStats(
      detail(categories, [
        deckEntry({
          card_id: 8,
          category_id: 2,
          card_name: "Mix",
          cost: ["LIF", "LIF-MET"],
          has_invoke_cost: true,
          invoke_cost: 2,
        }),
      ])
    )
    expect(stats.hybridPips).toBe(1)
    expect(stats.pipColors.find((row) => row.id === "LIF")?.count).toBe(
      1
    )
    expect(stats.rampQuality.find((row) => row.pips === 2)?.total).toBe(
      1
    )
  })

  it("folds three pips into the 2+ group", () => {
    const stats = buildDeckStats(
      detail([cat(2, "Entity")], [
        deckEntry({
          card_id: 9,
          category_id: 2,
          quantity: 2,
          card_name: "Wide",
          cost: ["LIF", "MET", "POW"],
          has_invoke_cost: true,
          invoke_cost: 3,
        }),
      ])
    )
    const two = stats.rampQuality.find((row) => row.pips === 2)
    expect(two?.total).toBe(2)
    expect(stats.rampQuality.some((row) => row.pips > 2)).toBe(
      false
    )
  })
})

describe("pay plan", () => {
  it("uses time for the generic pips, then waits for resources", () => {
    const categories = [
      cat(1, "Pilot", false),
      cat(2, "Entity"),
    ]
    const stats = buildDeckStats(
      detail(categories, [
        deckEntry({
          card_id: 1,
          category_id: 1,
          card_name: "Pilot",
          is_pilot: true,
          spirit_capacity: 2,
          has_invoke_cost: true,
          invoke_cost: 0,
        }),
        deckEntry({
          card_id: 2,
          category_id: 2,
          quantity: 3,
          card_name: "Heavy",
          has_invoke_cost: true,
          invoke_cost: 4,
          cost: ["LIF", "LIF", "GEN2"],
        }),
      ])
    )
    const slow = payPlanForCost(stats, ["LIF", "LIF", "GEN2"], "second", 0)
    expect(slow.payTurn).toBe(1)
    expect(slow.resolveTurn).toBe(3)
    expect(slow.usesTime).toBe(true)
    expect(timeWaitQuantity(stats, "second", 0)).toBe(3)
  })

  it("counts converted resources without time", () => {
    const stats = buildDeckStats(
      detail(
        [cat(1, "Pilot", false), cat(2, "Entity")],
        [
          deckEntry({
            card_id: 1,
            category_id: 1,
            card_name: "Pilot",
            is_pilot: true,
            ram_capacity: 2,
            power_capacity: 3,
          }),
          deckEntry({
            card_id: 2,
            category_id: 2,
            card_name: "Heavy",
            has_invoke_cost: true,
            invoke_cost: 8,
            cost: ["POW", "POW", "POW", "GEN5"],
          }),
        ]
      )
    )
    const needed = resourceNeed(["POW", "POW", "POW", "GEN5"])
    let stockpile = 0
    for (const amount of Object.values(stats.stockpile)) {
      stockpile += amount
    }
    expect(needed).toBe(8)
    expect(stockpile).toBe(5)
    const secondPool = startingStockpileForSeat(
      stockpile,
      "second"
    )
    const firstPool = startingStockpileForSeat(
      stockpile,
      "first"
    )
    expect(secondPool).toBe(5)
    expect(firstPool).toBe(3)
    expect(playTurnForRate(secondPool, needed, 1)).toBe(3)
    expect(playTurnForRate(secondPool, needed, 2)).toBe(2)
    expect(playTurnForRate(firstPool, needed, 1)).toBe(5)
    expect(playTurnForRate(firstPool, needed, 2)).toBe(3)
  })
})

describe("draw report", () => {
  it("follows the clicked cost", () => {
    const categories = [
      cat(1, "Pilot", false),
      cat(2, "Entity"),
    ]
    const deck = detail(categories, [
      deckEntry({
        card_id: 1,
        category_id: 1,
        card_name: "Pilot",
        is_pilot: true,
        hand_size: 5,
      }),
      deckEntry({
        card_id: 2,
        category_id: 2,
        quantity: 4,
        card_name: "Bolt",
        has_invoke_cost: true,
        invoke_cost: 1,
      }),
    ])
    const stats = buildDeckStats(deck)
    const report = drawReport(
      deck,
      stats,
      { kind: "cost", cost: 1 },
      "first",
      1
    )
    expect(report.matched).toBe(4)
    expect(report.label).toBe("cost 1")
    expect(report.atLeastOne).toBe(1)
  })

  it("follows the clicked ramp band", () => {
    const deck = detail([cat(2, "Entity")], [
      deckEntry({
        card_id: 1,
        category_id: 2,
        quantity: 2,
        card_name: "Blank",
        cost: [],
      }),
      deckEntry({
        card_id: 2,
        category_id: 2,
        quantity: 3,
        card_name: "Mix",
        cost: ["LIF", "LIF-MET"],
        has_invoke_cost: true,
        invoke_cost: 2,
      }),
    ])
    const stats = buildDeckStats(deck)
    const report = drawReport(
      deck,
      stats,
      { kind: "ramp", pips: 2 },
      "first",
      1
    )
    const none = stats.rampQuality.find((row) => row.pips === 0)
    const two = stats.rampQuality.find((row) => row.pips === 2)
    expect(none?.total).toBe(2)
    expect(two?.total).toBe(3)
    expect(report.matched).toBe(3)
    expect(report.label).toBe("2+ pips")
  })
})

describe("top spell", () => {
  it("uses the highest invoke cost, not the first name", () => {
    const stats = buildDeckStats(
      detail([cat(2, "Entity")], [
        deckEntry({
          card_id: 1,
          category_id: 2,
          card_name: "Alpha",
          has_invoke_cost: true,
          invoke_cost: 1,
          cost: ["LIF"],
        }),
        deckEntry({
          card_id: 2,
          category_id: 2,
          card_name: "Zeta",
          has_invoke_cost: true,
          invoke_cost: 6,
          cost: ["POW", "POW", "POW"],
        }),
      ])
    )
    expect(targetCard(stats)?.name).toBe("Zeta")
  })
})
