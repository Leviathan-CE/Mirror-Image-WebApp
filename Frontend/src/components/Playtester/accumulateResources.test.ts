import { describe, expect, it } from "vitest"

import {
  buildResourceTokenMap,
  findResourceTokenByCost,
} from "@/components/Playtester/accumulateResources"
import type { CardLibraryItem } from "@/lib/api/cards"

function card(
  partial: Pick<CardLibraryItem, "id" | "card_name"> &
    Partial<CardLibraryItem>
): CardLibraryItem {
  return {
    id: partial.id,
    card_name: partial.card_name,
    card_art_path: partial.card_art_path ?? null,
    card_art_version: partial.card_art_version ?? null,
    cost: partial.cost ?? [],
    super_types: partial.super_types ?? [],
    types_line: partial.types_line ?? "",
    sub_types: partial.sub_types ?? [],
  } as CardLibraryItem
}

describe("buildResourceTokenMap (Resource + invoke cost)", () => {
  const spiritWire = card({
    id: 1,
    card_name: "Spirit Wire",
    cost: ["LIF", "POW"],
    super_types: ["Entity", "Augment", "Technology"],
    types_line: "Entity Augment Technology",
  })
  const spiritPower = card({
    id: 2,
    card_name: "Spirit Power",
    cost: ["LIF"],
    super_types: ["Entity", "Token", "Resource"],
    types_line: "Arcane Spirit Power",
  })
  const steel = card({
    id: 3,
    card_name: "Steel",
    cost: ["GEN"],
    super_types: ["Entity", "Token", "Resource"],
    types_line: "Resource Token",
  })
  const livingMetal = card({
    id: 4,
    card_name: "Living Metal",
    cost: ["MET"],
    super_types: ["Entity", "Token", "Resource"],
  })
  const unitOfPower = card({
    id: 5,
    card_name: "Unit of Power",
    cost: ["POW"],
    super_types: ["Entity", "Token", "Resource"],
  })

  it("maps by Resource + cost colour, ignoring non-Resource cards", () => {
    const items = [spiritWire, spiritPower, steel, livingMetal, unitOfPower]
    expect(findResourceTokenByCost(items, "LIF")?.card_name).toBe(
      "Spirit Power"
    )
    expect(findResourceTokenByCost(items, "STL")?.card_name).toBe("Steel")
    expect(findResourceTokenByCost(items, "MET")?.card_name).toBe(
      "Living Metal"
    )
    expect(findResourceTokenByCost(items, "POW")?.card_name).toBe(
      "Unit of Power"
    )

    const map = buildResourceTokenMap(items)
    expect(map.get("LIF")?.id).toBe(2)
    expect(map.get("STL")?.id).toBe(3)
    expect(map.get("MET")?.id).toBe(4)
    expect(map.get("POW")?.id).toBe(5)
    expect(map.has("TIM")).toBe(false)
  })

  it("prefers exact single-pip Resource over hybrid cost", () => {
    const hybridResource = card({
      id: 9,
      card_name: "Weird Hybrid Resource",
      cost: ["LIF", "POW"],
      super_types: ["Resource"],
    })
    const map = buildResourceTokenMap([hybridResource, spiritPower])
    expect(map.get("LIF")?.card_name).toBe("Spirit Power")
  })
})
