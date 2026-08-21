import { describe, expect, it } from "vitest"

import {
  AUGMENT_LAYOUT,
  FACE,
  GENERATED_LAYOUT,
  RESOURCE_FAN_LAYOUT,
  augmentHome,
  flipFieldPoint,
  generatedResourceHome,
  placeAugmentsForView,
  placeInPlayForView,
  placedStockpileCount,
  placeStockpileForView,
  resourceAnchorX,
  resourceHomeY,
  worldToView,
} from "@/components/Playtester/augmentRow.logic"
import type { PlayingCardInstance } from "@/components/Playtester/types"

function augment(
  instanceId: string,
  owner: PlayingCardInstance["owner"],
  extras: Partial<PlayingCardInstance> = {}
): PlayingCardInstance {
  return {
    instanceId,
    owner,
    cardId: 9,
    name: "Ocular Rig",
    artPath: null,
    cost: [],
    zone: "battlefield",
    isAugment: true,
    expended: false,
    ...extras,
  }
}

function token(
  instanceId: string,
  owner: PlayingCardInstance["owner"],
  cost: string[],
  extras: Partial<PlayingCardInstance> = {}
): PlayingCardInstance {
  return {
    instanceId,
    owner,
    cardId: 1,
    name: "Token",
    artPath: null,
    cost,
    zone: "stockpile",
    isToken: true,
    expended: false,
    ...extras,
  }
}

const FIELD = { width: 900, height: 500 }

describe("augmentHome", () => {
  it("puts every local augment on the same offset grid from bottom-right", () => {
    const a = augmentHome(0, FIELD, true)
    const b = augmentHome(1, FIELD, true)
    const { start, offset, pad } = AUGMENT_LAYOUT
    expect(a).toEqual({
      x: FIELD.width - FACE.w - pad + start.x,
      y: FIELD.height - FACE.h - pad + start.y,
    })
    expect(b).toEqual({
      x: a.x + offset.x,
      y: a.y + offset.y,
    })
  })

  it("placeAugmentsForView applies that grid to every unmoved augment", () => {
    const placed = placeAugmentsForView(
      [augment("a", "p1"), augment("b", "p1"), augment("c", "p1")],
      "p1",
      FIELD
    )
    // Stable sort by instanceId: a, b, c
    expect(placed[0]?.x).toBe(augmentHome(0, FIELD, true).x)
    expect(placed[1]?.x).toBe(augmentHome(1, FIELD, true).x)
    expect(placed[2]?.x).toBe(augmentHome(2, FIELD, true).x)
    expect(placed[1]!.x! - placed[0]!.x!).toBe(AUGMENT_LAYOUT.offset.x)
    expect(placed[2]!.x! - placed[1]!.x!).toBe(AUGMENT_LAYOUT.offset.x)
  })

  it("keeps layout slots stable when session order changes (no swap on click)", () => {
    const forward = placeAugmentsForView(
      [augment("a", "p1"), augment("b", "p1")],
      "p1",
      FIELD
    )
    const reversed = placeAugmentsForView(
      [augment("b", "p1"), augment("a", "p1")],
      "p1",
      FIELD
    )
    const aFwd = forward.find((c) => c.instanceId === "a")
    const aRev = reversed.find((c) => c.instanceId === "a")
    expect(aFwd?.x).toBe(aRev?.x)
    expect(aFwd?.y).toBe(aRev?.y)
  })

  it("leaves a dragged augment alone", () => {
    const placed = placeAugmentsForView(
      [augment("moved", "p1", { x: 200, y: 60 })],
      "p1",
      FIELD
    )
    expect(placed[0]?.x).toBe(200)
    expect(placed[0]?.y).toBe(60)
  })
})

describe("resource fans", () => {
  it("anchors the first pile at bottom-center + start (near the hand)", () => {
    expect(resourceAnchorX(true, FIELD)).toBe(
      FIELD.width / 2 - FACE.w / 2 + RESOURCE_FAN_LAYOUT.start.x
    )
    expect(resourceHomeY(true, FIELD)).toBe(
      FIELD.height - FACE.h - RESOURCE_FAN_LAYOUT.pad + RESOURCE_FAN_LAYOUT.start.y
    )
  })

  it("spaces every card in a colour by offset", () => {
    const placed = placeStockpileForView(
      [
        token("a", "p1", ["LIF"]),
        token("b", "p1", ["LIF"]),
        token("c", "p1", ["LIF"]),
      ],
      "p1",
      FIELD
    )
    const { offset } = RESOURCE_FAN_LAYOUT
    expect(placed[1]!.x! - placed[0]!.x!).toBe(offset.x)
    expect(placed[2]!.x! - placed[1]!.x!).toBe(offset.x)
    expect(placed[1]!.y! - placed[0]!.y!).toBe(offset.y)
    expect(placed[2]!.y! - placed[1]!.y!).toBe(offset.y)
  })

  it("leaves a dragged token alone", () => {
    const placed = placeStockpileForView(
      [token("moved", "p1", ["TIM"], { x: 11, y: 22 })],
      "p1",
      FIELD
    )
    expect(placed[0]?.x).toBe(11)
    expect(placed[0]?.y).toBe(22)
  })
})

describe("generatedResourceHome", () => {
  it("fans from bottom-center using start + index * offset", () => {
    const first = generatedResourceHome(FIELD, true, 0)
    const second = generatedResourceHome(FIELD, true, 1)
    const { start, offset, pad } = GENERATED_LAYOUT
    expect(first).toEqual({
      x: FIELD.width / 2 - FACE.w / 2 + start.x,
      y: FIELD.height - FACE.h - pad + start.y,
    })
    expect(second).toEqual({
      x: first.x + offset.x,
      y: first.y + offset.y,
    })
  })

  it("does not treat opening tokens (no y) as occupying generate slots", () => {
    expect(placedStockpileCount([token("open", "p1", ["TIM"])], "p1")).toBe(0)
    expect(
      placedStockpileCount(
        [token("gen", "p1", ["TIM"], { x: 40, y: 80 })],
        "p1"
      )
    ).toBe(1)
  })
})

describe("world / view field flip", () => {
  it("is an involution (flip twice returns the origin)", () => {
    const point = { x: 220, y: 360 }
    const once = flipFieldPoint(point.x, point.y, FIELD)
    const twice = flipFieldPoint(once.x, once.y, FIELD)
    expect(twice).toEqual(point)
  })

  it("shows p1's bottom-right park as p2's top-left (across the table)", () => {
    const world = { x: FIELD.width - FACE.w - 10, y: FIELD.height - FACE.h - 40 }
    const asP1 = placeInPlayForView(
      [augment("parked", "p1", world)],
      "p1",
      FIELD
    )
    const asP2 = placeInPlayForView(
      [augment("parked", "p1", world)],
      "p2",
      FIELD
    )
    expect(asP1[0]?.x).toBe(world.x)
    expect(asP1[0]?.y).toBe(world.y)
    expect(asP2[0]?.x).toBe(flipFieldPoint(world.x, world.y, FIELD).x)
    expect(asP2[0]?.y).toBe(flipFieldPoint(world.x, world.y, FIELD).y)
    expect(asP2[0]!.x!).toBeLessThan(FIELD.width / 2)
    expect(asP2[0]!.y!).toBeLessThan(FIELD.height / 2)
  })

  it("leaves p1 world coords unchanged for the p1 viewer", () => {
    expect(worldToView(100, 200, "p1", FIELD)).toEqual({ x: 100, y: 200 })
  })
})
