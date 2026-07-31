import { describe, expect, it } from "vitest"

import { PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/playCard.logic"
import {
  destroyResourceCardIfLeaving,
  destroyResourceTokenIfLeaving,
  isResourceTokenInstance,
} from "@/components/Playtester/sessionResources.logic"

function card(
  overrides: Partial<PlayingCardInstance> &
    Pick<PlayingCardInstance, "instanceId" | "zone">
): PlayingCardInstance {
  return {
    cardId: overrides.cardId ?? 1,
    name: overrides.name ?? "Token",
    artPath: null,
    cost: [],
    expended: false,
    ...overrides,
  }
}

describe("isResourceTokenInstance", () => {
  it("detects the flag", () => {
    expect(
      isResourceTokenInstance(
        card({ instanceId: "r", zone: PLAY_ZONE.stockpile, isResourceToken: true })
      )
    ).toBe(true)
    expect(
      isResourceTokenInstance(
        card({ instanceId: "c", zone: PLAY_ZONE.hand, isResourceToken: false })
      )
    ).toBe(false)
  })
})

describe("destroyResourceTokenIfLeaving", () => {
  const token = card({
    instanceId: "tim",
    zone: PLAY_ZONE.stockpile,
    isResourceToken: true,
  })
  const unit = card({ instanceId: "u", zone: PLAY_ZONE.hand })

  it("destroys resource tokens entering destroy zones", () => {
    const cards = [token, unit]
    for (const zone of [
      PLAY_ZONE.hand,
      PLAY_ZONE.library,
      PLAY_ZONE.trashyard,
      PLAY_ZONE.dismantled,
      PLAY_ZONE.pilot,
    ] as const) {
      const next = destroyResourceTokenIfLeaving(cards, "tim", zone)
      expect(next?.map((c) => c.instanceId)).toEqual(["u"])
    }
  })

  it("returns null for battlefield / stockpile (caller moves normally)", () => {
    const cards = [token]
    expect(
      destroyResourceTokenIfLeaving(cards, "tim", PLAY_ZONE.battlefield)
    ).toBeNull()
    expect(
      destroyResourceTokenIfLeaving(cards, "tim", PLAY_ZONE.stockpile)
    ).toBeNull()
  })

  it("returns null for non-resource cards", () => {
    expect(
      destroyResourceTokenIfLeaving([unit], "u", PLAY_ZONE.hand)
    ).toBeNull()
  })
})

describe("destroyResourceCardIfLeaving", () => {
  it("drops a limbo resource instead of seating it in a destroy zone", () => {
    const limbo = card({
      instanceId: "tim",
      zone: PLAY_ZONE.library,
      isResourceToken: true,
    })
    const other = card({ instanceId: "u", zone: PLAY_ZONE.hand })
    const next = destroyResourceCardIfLeaving(
      [other, limbo],
      limbo,
      PLAY_ZONE.hand
    )
    expect(next?.map((c) => c.instanceId)).toEqual(["u"])
  })
})
