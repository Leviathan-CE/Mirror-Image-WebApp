import { describe, expect, it } from "vitest"

import { PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/playCard.logic"
import {
  destroySessionCardIfLeaving,
  destroySessionTokenIfLeaving,
  isResourceTokenInstance,
  isSessionTokenInstance,
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

describe("isSessionTokenInstance", () => {
  it("detects the flag", () => {
    expect(
      isSessionTokenInstance(
        card({ instanceId: "r", zone: PLAY_ZONE.stockpile, isToken: true })
      )
    ).toBe(true)
    expect(
      isSessionTokenInstance(
        card({ instanceId: "c", zone: PLAY_ZONE.hand, isToken: false })
      )
    ).toBe(false)
  })

  it("aliases isResourceTokenInstance", () => {
    const token = card({
      instanceId: "r",
      zone: PLAY_ZONE.stockpile,
      isToken: true,
    })
    expect(isResourceTokenInstance(token)).toBe(isSessionTokenInstance(token))
  })
})

describe("destroySessionTokenIfLeaving", () => {
  const token = card({
    instanceId: "tim",
    zone: PLAY_ZONE.stockpile,
    isToken: true,
  })
  const unit = card({ instanceId: "u", zone: PLAY_ZONE.hand })

  it("destroys session tokens entering destroy zones", () => {
    const cards = [token, unit]
    for (const zone of [
      PLAY_ZONE.hand,
      PLAY_ZONE.library,
      PLAY_ZONE.trashyard,
      PLAY_ZONE.dismantled,
      PLAY_ZONE.pilot,
    ] as const) {
      const next = destroySessionTokenIfLeaving(cards, "tim", zone)
      expect(next?.map((c) => c.instanceId)).toEqual(["u"])
    }
  })

  it("returns null for battlefield / stockpile (caller moves normally)", () => {
    const cards = [token]
    expect(
      destroySessionTokenIfLeaving(cards, "tim", PLAY_ZONE.battlefield)
    ).toBeNull()
    expect(
      destroySessionTokenIfLeaving(cards, "tim", PLAY_ZONE.stockpile)
    ).toBeNull()
  })

  it("returns null for non-token cards", () => {
    expect(
      destroySessionTokenIfLeaving([unit], "u", PLAY_ZONE.hand)
    ).toBeNull()
  })
})

describe("destroySessionCardIfLeaving", () => {
  it("drops a limbo token instead of seating it in a destroy zone", () => {
    const limbo = card({
      instanceId: "tim",
      zone: PLAY_ZONE.library,
      isToken: true,
    })
    const other = card({ instanceId: "u", zone: PLAY_ZONE.hand })
    const next = destroySessionCardIfLeaving(
      [other, limbo],
      limbo,
      PLAY_ZONE.hand
    )
    expect(next?.map((c) => c.instanceId)).toEqual(["u"])
  })
})
