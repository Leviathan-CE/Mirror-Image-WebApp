import { describe, expect, it } from "vitest"

import { materializeFog, viewFor } from "@/components/Playtester/fogView.logic"
import { createPlaySessionState } from "@/components/Playtester/sessionActions.logic"
import type { PlayerSlot } from "@/components/Playtester/constants"
import type { PlayingCardInstance } from "@/components/Playtester/types"

function augment(
  owner: PlayerSlot,
  overrides: Partial<PlayingCardInstance> = {}
): PlayingCardInstance {
  return {
    instanceId: `${owner}-augment-9-0`,
    owner,
    cardId: 9,
    name: "Ocular Rig",
    artPath: null,
    cost: [],
    zone: "battlefield",
    isAugment: true,
    expended: false,
    ...overrides,
  }
}

function stateWith(cards: PlayingCardInstance[]) {
  return createPlaySessionState({ cards })
}

describe("fog view augments", () => {
  it("keeps the opponent's augment flag so it renders in their row", () => {
    const view = viewFor("p1", stateWith([augment("p2")]))
    const seen = materializeFog(view).find((c) => c.owner === "p2")

    expect(seen?.isAugment).toBe(true)
  })

  it("keeps the flag when the augment is face-down and printing is hidden", () => {
    const view = viewFor("p1", stateWith([augment("p2", { faceDown: true })]))
    const seen = materializeFog(view).find((c) => c.owner === "p2")

    expect(seen?.isAugment).toBe(true)
    expect(seen?.faceDown).toBe(true)
    expect(seen?.name).toBe("")
  })

  it("passes the viewer's own augments through untouched", () => {
    const mine = augment("p1")
    const view = viewFor("p1", stateWith([mine]))

    expect(materializeFog(view)).toContain(mine)
  })
})
