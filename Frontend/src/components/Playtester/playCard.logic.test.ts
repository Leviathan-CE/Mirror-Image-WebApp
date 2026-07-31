import { describe, expect, it } from "vitest"

import { PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import {
  adjustCardCounter,
  cardsInZone,
  duplicatePlayingCard,
  readyBattlefieldAndStockpile,
  selectableActionTargets,
  setCardsFaceDown,
  toggleExpended,
  toggleFaceDown,
  type PlayingCardInstance,
} from "@/components/Playtester/playCard.logic"

function card(
  overrides: Partial<PlayingCardInstance> &
    Pick<PlayingCardInstance, "instanceId" | "zone">
): PlayingCardInstance {
  return {
    cardId: overrides.cardId ?? 1,
    name: overrides.name ?? "Test Card",
    artPath: overrides.artPath ?? null,
    cost: overrides.cost ?? [],
    expended: overrides.expended ?? false,
    selected: overrides.selected,
    faceDown: overrides.faceDown,
    isResourceToken: overrides.isResourceToken,
    timeCounters: overrides.timeCounters,
    damageCounters: overrides.damageCounters,
    tlvCounters: overrides.tlvCounters,
    x: overrides.x,
    y: overrides.y,
    ...overrides,
  }
}

describe("toggleFaceDown / setCardsFaceDown", () => {
  it("toggles a single card", () => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.hand, faceDown: false })]
    const next = toggleFaceDown(cards, "a")
    expect(next[0]?.faceDown).toBe(true)
    expect(toggleFaceDown(next, "a")[0]?.faceDown).toBe(false)
  })

  it("sets many cards to one shared face state (multi-select)", () => {
    const cards = [
      card({ instanceId: "a", zone: PLAY_ZONE.hand, faceDown: false, selected: true }),
      card({ instanceId: "b", zone: PLAY_ZONE.battlefield, faceDown: true, selected: true }),
      card({ instanceId: "c", zone: PLAY_ZONE.hand, faceDown: false, selected: false }),
    ]
    const next = setCardsFaceDown(cards, ["a", "b"], true)
    expect(next.find((c) => c.instanceId === "a")?.faceDown).toBe(true)
    expect(next.find((c) => c.instanceId === "b")?.faceDown).toBe(true)
    expect(next.find((c) => c.instanceId === "c")?.faceDown).toBe(false)
  })
})

describe("selectableActionTargets", () => {
  it("returns only the focus card when it is not selected", () => {
    const focus = card({
      instanceId: "a",
      zone: PLAY_ZONE.hand,
      selected: false,
    })
    const cards = [
      focus,
      card({ instanceId: "b", zone: PLAY_ZONE.hand, selected: true }),
    ]
    expect(selectableActionTargets(cards, focus)).toEqual(["a"])
  })

  it("returns all selected selectable-zone cards when focus is selected", () => {
    const focus = card({
      instanceId: "a",
      zone: PLAY_ZONE.hand,
      selected: true,
    })
    const cards = [
      focus,
      card({ instanceId: "b", zone: PLAY_ZONE.battlefield, selected: true }),
      card({ instanceId: "c", zone: PLAY_ZONE.stockpile, selected: true }),
      card({ instanceId: "d", zone: PLAY_ZONE.pilot, selected: true }),
      card({ instanceId: "e", zone: PLAY_ZONE.hand, selected: false }),
    ]
    expect(selectableActionTargets(cards, focus).sort()).toEqual([
      "a",
      "b",
      "c",
    ])
  })
})

describe("readyBattlefieldAndStockpile", () => {
  it("readies BF/stockpile and ticks time counters down by 1", () => {
    const cards = [
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        expended: true,
        selected: true,
        timeCounters: 2,
      }),
      card({
        instanceId: "sp",
        zone: PLAY_ZONE.stockpile,
        expended: true,
        timeCounters: 1,
      }),
      card({
        instanceId: "hand",
        zone: PLAY_ZONE.hand,
        expended: true,
        timeCounters: 3,
      }),
    ]
    const next = readyBattlefieldAndStockpile(cards)
    const bf = next.find((c) => c.instanceId === "bf")!
    const sp = next.find((c) => c.instanceId === "sp")!
    const hand = next.find((c) => c.instanceId === "hand")!
    expect(bf.expended).toBe(false)
    expect(bf.selected).toBe(false)
    expect(bf.timeCounters).toBe(1)
    expect(sp.timeCounters).toBe(0)
    expect(hand.expended).toBe(true)
    expect(hand.timeCounters).toBe(3)
  })
})

describe("adjustCardCounter", () => {
  it("adds and never goes below 0", () => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.battlefield })]
    const up = adjustCardCounter(cards, "a", "damage", 2)
    expect(up[0]?.damageCounters).toBe(2)
    const down = adjustCardCounter(up, "a", "damage", -5)
    expect(down[0]?.damageCounters).toBe(0)
  })
})

describe("cardsInZone / toggleExpended / duplicatePlayingCard", () => {
  it("filters by zone", () => {
    const cards = [
      card({ instanceId: "a", zone: PLAY_ZONE.hand }),
      card({ instanceId: "b", zone: PLAY_ZONE.library }),
    ]
    expect(cardsInZone(cards, PLAY_ZONE.hand).map((c) => c.instanceId)).toEqual([
      "a",
    ])
  })

  it("toggles expended", () => {
    const cards = [
      card({ instanceId: "a", zone: PLAY_ZONE.battlefield, expended: false }),
    ]
    expect(toggleExpended(cards, "a")[0]?.expended).toBe(true)
  })

  it("duplicates free-float cards and preserves faceDown", () => {
    const cards = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        x: 10,
        y: 20,
        faceDown: true,
      }),
    ]
    const next = duplicatePlayingCard(cards, "a")
    expect(next).toHaveLength(2)
    const copy = next[1]!
    expect(copy.instanceId).not.toBe("a")
    expect(copy.faceDown).toBe(true)
    expect(copy.x).toBe(38)
    expect(copy.y).toBe(48)
  })

  it("does not duplicate hand cards", () => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.hand })]
    expect(duplicatePlayingCard(cards, "a")).toBe(cards)
  })
})
