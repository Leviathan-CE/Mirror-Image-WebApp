import { describe, expect, it } from "vitest"

import {
  AUGMENT_CARD_H,
  AUGMENT_PAD,
  AUGMENT_STEP_X,
  placeAugmentsForView,
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

const UNIT = {
  instanceId: "unit-1",
  owner: "p1" as const,
  cardId: 4,
  name: "Street Runner",
  artPath: null,
  cost: [],
  zone: "battlefield" as const,
  expended: false,
  x: 80,
  y: 90,
}

describe("placeAugmentsForView", () => {
  it("pins local augments to the stockpile edge and opponent ones to the far edge", () => {
    const placed = placeAugmentsForView(
      [augment("mine", "p1"), augment("theirs", "p2")],
      "p1",
      400
    )

    expect(placed[0]?.y).toBe(400 - AUGMENT_CARD_H - AUGMENT_PAD)
    expect(placed[1]?.y).toBe(AUGMENT_PAD)
    expect(placed[0]?.x).toBe(AUGMENT_PAD)
    expect(placed[1]?.x).toBe(AUGMENT_PAD)
  })

  it("staggers extra copies of the same owner instead of stacking them", () => {
    const placed = placeAugmentsForView(
      [augment("a", "p1"), augment("b", "p1")],
      "p1",
      400
    )

    expect(placed[1]?.x).toBe(AUGMENT_PAD + AUGMENT_STEP_X)
    expect(placed[0]?.y).toBe(placed[1]?.y)
  })

  it("leaves a card the player already moved where they put it", () => {
    const placed = placeAugmentsForView(
      [augment("moved", "p1", { x: 200, y: 60 })],
      "p1",
      400
    )

    expect(placed[0]?.x).toBe(200)
    expect(placed[0]?.y).toBe(60)
  })

  it("does not move non-augment battlefield cards", () => {
    const placed = placeAugmentsForView([UNIT], "p1", 400)
    expect(placed[0]).toEqual(UNIT)
  })
})
