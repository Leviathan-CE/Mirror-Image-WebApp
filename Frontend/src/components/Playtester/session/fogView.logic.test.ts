import { describe, expect, it } from "vitest"

import {
  applySharedSelection,
  materializeFog,
  sharedSelectionIds,
  viewFor,
  withPeerSelectionChrome,
  withPreservedSelection,
} from "@/components/Playtester/session/fogView.logic"
import { createPlaySessionState } from "@/components/Playtester/session/sessionActions.logic"
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

  it("strips selection on public opponent cards (selection is local-only)", () => {
    const picked = augment("p2", { selected: true })
    const view = viewFor("p1", stateWith([picked]))
    const seen = materializeFog(view).find((c) => c.instanceId === picked.instanceId)
    expect(seen?.selected).toBe(false)
  })

  it("preserves local selection on own and opponent cards across fog", () => {
    const mine = augment("p1", { selected: false, instanceId: "p1-a" })
    const peer = augment("p2", { selected: true, instanceId: "p2-a" })
    const fogged = materializeFog(viewFor("p1", stateWith([mine, peer])))
    const kept = withPreservedSelection(fogged, new Set(["p1-a", "p2-a"]))
    expect(kept.find((c) => c.instanceId === "p1-a")?.selected).toBe(true)
    expect(kept.find((c) => c.instanceId === "p2-a")?.selected).toBe(true)
  })

  it("withPeerSelectionChrome can force peer selected flags (unused in UI)", () => {
    const peer = augment("p2", { selected: true })
    const fogged = materializeFog(viewFor("p1", stateWith([peer])))
    const cleared = withPeerSelectionChrome(fogged, "p2", new Set())
    expect(cleared.find((c) => c.instanceId === peer.instanceId)?.selected).toBe(
      false
    )
  })
})

describe("sharedSelectionIds / applySharedSelection", () => {
  it("drops hand and library ids so private clicks never leave this client", () => {
    const cards = [
      augment("p1", { instanceId: "bf", zone: "battlefield" }),
      augment("p1", { instanceId: "hd", zone: "hand" }),
      augment("p1", { instanceId: "lb", zone: "library" }),
    ]
    expect(sharedSelectionIds(cards, ["bf", "hd", "lb"])).toEqual(["bf"])
  })

  it("paints public rings without touching a private-zone card", () => {
    const cards = [
      augment("p1", { instanceId: "bf", zone: "battlefield", selected: false }),
      augment("p2", { instanceId: "opp", zone: "battlefield", selected: false }),
      augment("p1", { instanceId: "hd", zone: "hand", selected: true }),
    ]
    const next = applySharedSelection(cards, new Set(["opp"]))
    expect(next.find((c) => c.instanceId === "bf")?.selected).toBe(false)
    expect(next.find((c) => c.instanceId === "opp")?.selected).toBe(true)
    expect(next.find((c) => c.instanceId === "hd")?.selected).toBe(true)
  })

  it("empty ids clear every public ring", () => {
    const cards = [
      augment("p2", { instanceId: "opp", selected: true }),
      augment("p1", { instanceId: "hd", zone: "hand", selected: true }),
    ]
    const next = applySharedSelection(cards, new Set())
    expect(next.find((c) => c.instanceId === "opp")?.selected).toBe(false)
    expect(next.find((c) => c.instanceId === "hd")?.selected).toBe(true)
  })
})
