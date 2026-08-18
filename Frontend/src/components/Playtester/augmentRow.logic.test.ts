import { describe, expect, it } from "vitest"

import {
  AUGMENT_CARD_H,
  AUGMENT_LIFT_Y,
  AUGMENT_PAD,
  AUGMENT_STEP_X,
  GENERATED_RESOURCE_STEP_X,
  RESOURCE_CARD_H,
  RESOURCE_CARD_W,
  RESOURCE_FAN_GROUP_GAP,
  RESOURCE_FAN_STAGGER_X,
  RESOURCE_FAN_STAGGER_Y,
  augmentHomeX,
  augmentHomeY,
  generatedResourceHome,
  placeAugmentsForView,
  placedStockpileCount,
  placeStockpileForView,
  resourceAnchorX,
  resourceHomeY,
} from "@/components/Playtester/augmentRow.logic"
import { defaultHandFloatBox } from "@/components/Playtester/handFloatPanel.logic"
import { PLAY_PILE_SIZE } from "@/components/Playtester/playtesterConstants"
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

const FIELD = { width: 900, height: 500 }

describe("placeAugmentsForView", () => {
  it("pins local augments above the hand on the deck edge", () => {
    const placed = placeAugmentsForView(
      [augment("mine", "p1"), augment("theirs", "p2")],
      "p1",
      FIELD
    )
    const localHand = defaultHandFloatBox(FIELD, "bottom")
    const oppHand = defaultHandFloatBox(FIELD, "top")

    expect(placed[0]?.y).toBe(
      Math.max(
        AUGMENT_PAD,
        localHand.y - AUGMENT_CARD_H - AUGMENT_PAD - AUGMENT_LIFT_Y
      )
    )
    expect(placed[1]?.y).toBe(oppHand.y + oppHand.height + AUGMENT_PAD)
    expect(placed[0]?.x).toBe(
      FIELD.width - AUGMENT_PAD - PLAY_PILE_SIZE.lg.w
    )
    expect(placed[1]?.x).toBe(AUGMENT_PAD)
    expect(placed[0]?.x).toBe(augmentHomeX(0, FIELD, true))
    expect(placed[1]?.x).toBe(augmentHomeX(0, FIELD, false))
    expect(placed[0]?.y).toBe(augmentHomeY(true, FIELD))
    expect(placed[1]?.y).toBe(augmentHomeY(false, FIELD))
  })

  it("staggers extra local copies left, away from the deck", () => {
    const placed = placeAugmentsForView(
      [augment("a", "p1"), augment("b", "p1")],
      "p1",
      FIELD
    )

    expect(placed[1]?.x).toBe(augmentHomeX(1, FIELD, true))
    expect(placed[1]?.x).toBe(placed[0]!.x! - AUGMENT_STEP_X)
    expect(placed[0]?.y).toBe(placed[1]?.y)
  })

  it("leaves a card the player already moved where they put it", () => {
    const placed = placeAugmentsForView(
      [augment("moved", "p1", { x: 200, y: 60 })],
      "p1",
      FIELD
    )

    expect(placed[0]?.x).toBe(200)
    expect(placed[0]?.y).toBe(60)
  })

  it("does not move non-augment battlefield cards", () => {
    const placed = placeAugmentsForView([UNIT], "p1", FIELD)
    expect(placed[0]).toEqual(UNIT)
  })
})

describe("placeStockpileForView", () => {
  it("sits local tokens left of the hand and opponent tokens to the right of theirs", () => {
    const placed = placeStockpileForView(
      [token("mine", "p1", ["TIM"]), token("theirs", "p2", ["TIM"])],
      "p1",
      FIELD
    )

    expect(placed[0]?.y).toBe(resourceHomeY(true, FIELD))
    expect(placed[1]?.y).toBe(resourceHomeY(false, FIELD))
    expect(placed[0]?.x).toBe(resourceAnchorX(true, FIELD))
    expect(placed[1]?.x).toBe(resourceAnchorX(false, FIELD))
  })

  it("separates colours into piles growing away from the hand", () => {
    const placed = placeStockpileForView(
      [
        token("lif-0", "p1", ["LIF"]),
        token("lif-1", "p1", ["LIF"]),
        token("tim-0", "p1", ["TIM"]),
      ],
      "p1",
      FIELD
    )

    const homeY = resourceHomeY(true, FIELD)
    const origin = resourceAnchorX(true, FIELD)
    expect(placed[0]?.x).toBe(origin)
    expect(placed[1]?.x).toBe(origin - RESOURCE_FAN_STAGGER_X)
    expect(placed[0]?.y).toBe(homeY)
    expect(placed[1]?.y).toBe(homeY - RESOURCE_FAN_STAGGER_Y)

    const timX =
      origin -
      (RESOURCE_CARD_W + RESOURCE_FAN_STAGGER_X + RESOURCE_FAN_GROUP_GAP)
    expect(placed[2]?.x).toBe(timX)
    expect(placed[2]?.y).toBe(homeY)
  })

  it("keeps a gap beside the hand when the field is wide enough", () => {
    const wide = { width: 1400, height: 500 }
    const placed = placeStockpileForView(
      [token("mine", "p1", ["TIM"])],
      "p1",
      wide
    )
    expect(placed[0]?.x).toBe(resourceAnchorX(true, wide))
  })

  it("leaves a token the player already moved where they put it", () => {
    const placed = placeStockpileForView(
      [token("moved", "p1", ["TIM"], { x: 200, y: 60 })],
      "p1",
      FIELD
    )

    expect(placed[0]?.x).toBe(200)
    expect(placed[0]?.y).toBe(60)
  })
})

describe("generatedResourceHome", () => {
  it("sits above the default hand and steps extras along it", () => {
    const hand = defaultHandFloatBox(FIELD, "bottom")
    const first = generatedResourceHome(FIELD, true, 0)
    const second = generatedResourceHome(FIELD, true, 1)
    expect(first.y).toBe(
      Math.max(AUGMENT_PAD, hand.y - RESOURCE_CARD_H - AUGMENT_PAD)
    )
    expect(first.x).toBe(hand.x)
    expect(second.x).toBe(first.x + GENERATED_RESOURCE_STEP_X)
    expect(second.y).toBe(first.y)
  })

  it("keeps a high index on the field instead of walking off the right edge", () => {
    const far = generatedResourceHome(FIELD, true, 50)
    expect(far.x).toBeGreaterThanOrEqual(AUGMENT_PAD)
    expect(far.x + RESOURCE_CARD_W).toBeLessThanOrEqual(FIELD.width)
  })

  it("does not treat opening tokens (no y) as occupying generate slots", () => {
    expect(
      placedStockpileCount(
        [token("open", "p1", ["TIM"])],
        "p1"
      )
    ).toBe(0)
    expect(
      placedStockpileCount(
        [token("gen", "p1", ["TIM"], { x: 40, y: 80 })],
        "p1"
      )
    ).toBe(1)
  })
})
