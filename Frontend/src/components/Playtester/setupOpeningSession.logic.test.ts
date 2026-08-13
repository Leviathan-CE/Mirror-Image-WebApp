import { describe, expect, it } from "vitest"

import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckCardEntry } from "@/lib/api/decks"
import type { ResourceColor } from "@/components/Playtester/accumulateResources.logic"
import {
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
  })

  it("skips colours missing from the catalogue map", () => {
    const byColor = new Map<ResourceColor, CardLibraryItem>([
      ["STL", resource(11, "Steel", ["GEN"])],
    ])
    const spawned = spawnGroupedStockpileResources(["TIM", "STL"], byColor)
    expect(spawned).toHaveLength(1)
    expect(spawned[0]?.name).toBe("Steel")
  })
})
