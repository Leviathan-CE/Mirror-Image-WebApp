import { describe, expect, it } from "vitest"

import {
  ACCUMULATE_MAX_PIPS,
  buildResourceTokenMap,
  autoResolveColors,
  canAutoResolvePips,
  catalogueCoversColors,
  classifyCostToken,
  collectResourceCatalogue,
  extractGainablePips,
  findResourceTokenByCost,
} from "@/components/Playtester/session/accumulateResources.logic"
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

  it("maps TIM from a Resource whose cost pip is TIM", () => {
    const naturalTime = card({
      id: 1044497,
      card_name: "Natural Time",
      cost: ["TIM"],
      super_types: ["Token", "Entity", "Resource"],
      types_line: "Natural Chornomancy",
    })
    expect(findResourceTokenByCost([naturalTime, steel], "TIM")?.card_name).toBe(
      "Natural Time"
    )
    const map = buildResourceTokenMap([naturalTime, steel, spiritPower])
    expect(map.get("TIM")?.id).toBe(1044497)
    expect(map.get("STL")?.card_name).toBe("Steel")
  })
})

describe("classifyCostToken / extractGainablePips (GEN → STL)", () => {
  it("maps TIM as solid TIM", () => {
    expect(classifyCostToken("TIM")).toEqual({
      kind: "solid",
      token: "TIM",
      color: "TIM",
    })
  })

  it("does not treat TIME as TIM", () => {
    expect(classifyCostToken("TIME")).toBeNull()
  })

  it("maps bare GEN to solid STL", () => {
    expect(classifyCostToken("GEN")).toEqual({
      kind: "solid",
      token: "GEN",
      color: "STL",
    })
  })

  it("does not treat numbered GEN or GENX as STL", () => {
    expect(classifyCostToken("GEN2")).toBeNull()
    expect(classifyCostToken("GENX")).toBeNull()
  })

  it("extracts STL from a cost that includes GEN", () => {
    expect(extractGainablePips(["GEN", "TIM", "LIF"])).toEqual([
      { kind: "solid", token: "GEN", color: "STL" },
      { kind: "solid", token: "TIM", color: "TIM" },
      { kind: "solid", token: "LIF", color: "LIF" },
    ])
  })
})

describe("accumulate pip cap", () => {
  it("auto-resolves at most ACCUMULATE_MAX_PIPS solid pips", () => {
    expect(ACCUMULATE_MAX_PIPS).toBe(2)
    const pips = extractGainablePips(["LIF", "MET", "POW"])
    expect(canAutoResolvePips(pips)).toBe(false)
    expect(autoResolveColors(pips)).toEqual(["LIF", "MET"])
  })

  it("auto-resolves two or fewer solid pips without a chooser", () => {
    const pips = extractGainablePips(["RAM", "STL"])
    expect(canAutoResolvePips(pips)).toBe(true)
    expect(autoResolveColors(pips)).toEqual(["RAM", "STL"])
  })

  it("skips the chooser when extra pips are all the same colour", () => {
    const pips = extractGainablePips(["LIF", "LIF", "LIF"])
    expect(canAutoResolvePips(pips)).toBe(true)
    expect(autoResolveColors(pips)).toEqual(["LIF", "LIF"])
  })

  it("still opens the chooser when extra pips include a hybrid", () => {
    const pips = extractGainablePips(["LIF", "LIF", "LIF-MET"])
    expect(canAutoResolvePips(pips)).toBe(false)
  })
})

describe("catalogueCoversColors / collectResourceCatalogue", () => {
  it("is uncovered when page 1 has no TIM pip", () => {
    const page1 = [
      card({
        id: 2,
        card_name: "Spirit Power",
        cost: ["LIF"],
        super_types: ["Resource"],
      }),
    ]
    const map = buildResourceTokenMap(page1)
    expect(map.has("TIM")).toBe(false)
    expect(catalogueCoversColors(map, ["LIF", "TIM"])).toBe(false)
  })

  it("covers TIM after a later Resource page with a TIM pip", async () => {
    const page1 = [
      card({
        id: 2,
        card_name: "Spirit Power",
        cost: ["LIF"],
        super_types: ["Resource"],
      }),
    ]
    const page2 = [
      card({
        id: 10,
        card_name: "Time Token",
        cost: ["TIM"],
        super_types: ["Resource"],
      }),
    ]
    const result = await collectResourceCatalogue({
      needed: ["LIF", "TIM"],
      pageSize: 1,
      fetchPage: async (offset) => {
        if (offset === 0) return { items: page1, total: 2 }
        return { items: page2, total: 2 }
      },
    })
    const map = buildResourceTokenMap(result.tokens)
    expect(result.covered).toBe(true)
    expect(map.has("TIM")).toBe(true)
    expect(map.get("TIM")?.cost).toEqual(["TIM"])
  })

  it("stops paging once needed colours are covered", async () => {
    let pages = 0
    const result = await collectResourceCatalogue({
      needed: ["TIM"],
      pageSize: 1,
      fetchPage: async () => {
        pages += 1
        return {
          items: [
            card({
              id: 10,
              card_name: "Time Token",
              cost: ["TIM"],
              super_types: ["Resource"],
            }),
          ],
          total: 99,
        }
      },
    })
    expect(result.covered).toBe(true)
    expect(pages).toBe(1)
  })

  it("uses the TIM pip shortcut without a name search", async () => {
    const result = await collectResourceCatalogue({
      needed: ["TIM"],
      pageSize: 1,
      fetchPage: async () => ({ items: [], total: 0 }),
      fetchTimShortcut: async () => ({
        items: [
          card({
            id: 10,
            card_name: "Time Token",
            cost: ["TIM"],
            super_types: ["Resource"],
          }),
        ],
      }),
    })
    expect(result.covered).toBe(true)
    expect(buildResourceTokenMap(result.tokens).has("TIM")).toBe(true)
  })
})
