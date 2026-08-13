import { describe, expect, it } from "vitest"

import {
  DROP_ZONE_PRIORITY,
  clearFloatSelection,
  handCardsForBattlefield,
  libraryPutFlyMode,
  movableForLibraryDrop,
  planHandDrop,
  planLibraryDrop,
  pointInZoneRect,
  resolveDropZone,
  shouldFlipIntoHand,
  type DropZoneRects,
  type ZoneRect,
} from "@/components/Playtester/cardDragDrop.logic"
import {
  FLIP_FLY_MODE,
  PLAY_ZONE,
} from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/playCard.logic"

function card(
  overrides: Partial<PlayingCardInstance> &
    Pick<PlayingCardInstance, "instanceId" | "zone">
): PlayingCardInstance {
  return {
    cardId: overrides.cardId ?? 1,
    name: overrides.name ?? "Card",
    artPath: null,
    cost: overrides.cost ?? [],
    expended: false,
    ...overrides,
  }
}

function rect(
  left: number,
  top: number,
  right: number,
  bottom: number
): ZoneRect {
  return { left, top, right, bottom }
}

describe("pointInZoneRect", () => {
  it("rejects null and points outside", () => {
    expect(pointInZoneRect(1, 1, null)).toBe(false)
    expect(pointInZoneRect(0, 0, rect(10, 10, 20, 20))).toBe(false)
  })

  it("accepts inclusive edges", () => {
    const box = rect(10, 10, 20, 20)
    expect(pointInZoneRect(10, 10, box)).toBe(true)
    expect(pointInZoneRect(20, 20, box)).toBe(true)
    expect(pointInZoneRect(15, 15, box)).toBe(true)
  })
})

describe("resolveDropZone", () => {
  const rects: DropZoneRects = {
    [PLAY_ZONE.library]: rect(0, 0, 40, 40),
    [PLAY_ZONE.hand]: rect(0, 100, 200, 160),
    [PLAY_ZONE.battlefield]: rect(50, 50, 300, 90),
    [PLAY_ZONE.trashyard]: rect(300, 0, 340, 40),
  }

  it("uses source priority when zones overlap", () => {
    // Overlap library + a fictional hand covering the same point — library wins
    // for every source that lists library before hand.
    const overlap: DropZoneRects = {
      [PLAY_ZONE.library]: rect(0, 0, 100, 100),
      [PLAY_ZONE.hand]: rect(0, 0, 100, 100),
    }
    expect(resolveDropZone(50, 50, overlap, "battlefield")).toBe(
      PLAY_ZONE.library
    )
    expect(resolveDropZone(50, 50, overlap, "hand")).toBe(PLAY_ZONE.library)
  })

  it("returns hand for battlefield source when only hand is hit", () => {
    expect(resolveDropZone(20, 120, rects, "battlefield")).toBe(PLAY_ZONE.hand)
  })

  it("does not offer hand as a target when dragging from hand", () => {
    expect(DROP_ZONE_PRIORITY.hand.includes(PLAY_ZONE.hand)).toBe(false)
    expect(resolveDropZone(20, 120, rects, "hand")).toBeNull()
  })

  it("returns null when nothing is hit", () => {
    expect(resolveDropZone(999, 999, rects, "stockpile")).toBeNull()
  })

  it("lists every drop source in DROP_ZONE_PRIORITY", () => {
    expect(Object.keys(DROP_ZONE_PRIORITY).sort()).toEqual(
      ["battlefield", "faceUpPile", "hand", "stockpile"].sort()
    )
  })
})

describe("libraryPutFlyMode / shouldFlipIntoHand", () => {
  it("slides face-down cards onto the library and flips face-up ones", () => {
    expect(libraryPutFlyMode({ faceDown: true })).toBe(FLIP_FLY_MODE.faceDown)
    expect(libraryPutFlyMode({ faceDown: false })).toBe(FLIP_FLY_MODE.put)
    expect(libraryPutFlyMode({})).toBe(FLIP_FLY_MODE.put)
  })

  it("flips face-down non-tokens into hand only when the overlay is free", () => {
    const faceDown = card({
      instanceId: "a",
      zone: PLAY_ZONE.battlefield,
      faceDown: true,
    })
    expect(shouldFlipIntoHand(faceDown, false)).toBe(true)
    expect(shouldFlipIntoHand(faceDown, true)).toBe(false)
    expect(
      shouldFlipIntoHand(
        card({ instanceId: "b", zone: PLAY_ZONE.battlefield, faceDown: false }),
        false
      )
    ).toBe(false)
    expect(
      shouldFlipIntoHand(
        card({
          instanceId: "tim",
          zone: PLAY_ZONE.stockpile,
          faceDown: true,
          isToken: true,
        }),
        false
      )
    ).toBe(false)
  })
})

describe("planLibraryDrop", () => {
  it("blocks when a flip is already flying", () => {
    expect(
      planLibraryDrop(
        [card({ instanceId: "a", zone: PLAY_ZONE.hand })],
        true
      )
    ).toEqual({ kind: "blocked" })
  })

  it("destroys resource-only drops", () => {
    const plan = planLibraryDrop(
      [
        card({
          instanceId: "tim",
          zone: PLAY_ZONE.stockpile,
          isToken: true,
        }),
      ],
      false
    )
    expect(plan).toEqual({
      kind: "destroyOnly",
      resourceIds: ["tim"],
    })
  })

  it("animates a single face-down card with faceDown mode", () => {
    const faceDown = card({
      instanceId: "a",
      zone: PLAY_ZONE.battlefield,
      faceDown: true,
    })
    expect(planLibraryDrop([faceDown], false)).toEqual({
      kind: "animate",
      card: faceDown,
      mode: FLIP_FLY_MODE.faceDown,
      destroyResourceIds: [],
    })
  })

  it("animates a single face-up card with put mode", () => {
    const faceUp = card({ instanceId: "a", zone: PLAY_ZONE.hand })
    const plan = planLibraryDrop([faceUp], false)
    expect(plan.kind).toBe("animate")
    if (plan.kind === "animate") {
      expect(plan.mode).toBe(FLIP_FLY_MODE.put)
    }
  })

  it("instantly seats multiple cards and strips tokens first", () => {
    const plan = planLibraryDrop(
      [
        card({
          instanceId: "tim",
          zone: PLAY_ZONE.stockpile,
          isToken: true,
        }),
        card({ instanceId: "a", zone: PLAY_ZONE.hand }),
        card({ instanceId: "b", zone: PLAY_ZONE.hand }),
      ],
      false
    )
    expect(plan).toMatchObject({
      kind: "instant",
      destroyResourceIds: ["tim"],
    })
    if (plan.kind === "instant") {
      expect(plan.cards.map((c) => c.instanceId)).toEqual(["a", "b"])
    }
  })

  it("ignores cards already in the library", () => {
    const session = [
      card({ instanceId: "lib", zone: PLAY_ZONE.library }),
      card({ instanceId: "h", zone: PLAY_ZONE.hand }),
    ]
    expect(
      movableForLibraryDrop(session, ["lib", "h"]).map((c) => c.instanceId)
    ).toEqual(["h"])
  })
})

describe("planHandDrop", () => {
  it("splits face-down flips from instant seats", () => {
    const plan = planHandDrop(
      [
        card({
          instanceId: "down",
          zone: PLAY_ZONE.battlefield,
          faceDown: true,
        }),
        card({
          instanceId: "up",
          zone: PLAY_ZONE.battlefield,
          faceDown: false,
        }),
        card({
          instanceId: "tim",
          zone: PLAY_ZONE.stockpile,
          faceDown: true,
          isToken: true,
        }),
      ],
      false
    )
    expect(plan.kind).toBe("seat")
    if (plan.kind === "seat") {
      expect(plan.toFlip.map((c) => c.instanceId)).toEqual(["down"])
      expect(plan.instant.map((c) => c.instanceId).sort()).toEqual([
        "tim",
        "up",
      ])
    }
  })

  it("seats face-down cards instantly when flip is busy", () => {
    const plan = planHandDrop(
      [
        card({
          instanceId: "down",
          zone: PLAY_ZONE.battlefield,
          faceDown: true,
        }),
      ],
      true
    )
    expect(plan).toEqual({
      kind: "seat",
      instant: [
        expect.objectContaining({ instanceId: "down" }),
      ],
      toFlip: [],
    })
  })
})

describe("clearFloatSelection / handCardsForBattlefield", () => {
  it("clears selection only on float zones", () => {
    const next = clearFloatSelection([
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        selected: true,
      }),
      card({ instanceId: "lib", zone: PLAY_ZONE.library, selected: true }),
    ])
    expect(next.find((c) => c.instanceId === "bf")?.selected).toBe(false)
    expect(next.find((c) => c.instanceId === "lib")?.selected).toBe(true)
  })

  it("filters to cards still in hand", () => {
    const session = [
      card({ instanceId: "h", zone: PLAY_ZONE.hand }),
      card({ instanceId: "bf", zone: PLAY_ZONE.battlefield }),
    ]
    expect(handCardsForBattlefield(session, ["h", "bf", "missing"])).toEqual([
      "h",
    ])
  })
})
