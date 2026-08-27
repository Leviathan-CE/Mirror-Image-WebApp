import { describe, expect, it } from "vitest"

import { PLAY_ZONE } from "@/components/Playtester/constants"
import type { PlayingCardInstance } from "@/components/Playtester/session/playCard.logic"
import { libraryCardsInOrder } from "@/components/Playtester/search/deckActions.logic"
import { isFogStub, materializeFog, viewFor } from "@/components/Playtester/session/fogView.logic"
import { mulberry32 } from "@/components/Playtester/session/rng.logic"
import {
  applyAction,
  applyActions,
  createPlaySessionState,
  seatRecord,
  type SessionAction,
} from "@/components/Playtester/session/sessionActions.logic"

function card(
  overrides: Partial<PlayingCardInstance> &
    Pick<PlayingCardInstance, "instanceId" | "zone">
): PlayingCardInstance {
  return {
    cardId: overrides.cardId ?? 1,
    name: overrides.name ?? "Card",
    artPath: null,
    cost: [],
    owner: "p1",
    expended: false,
    ...overrides,
  }
}

describe("mulberry32", () => {
  it("replays the same stream from the same seed", () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const streamA = [a.next(), a.next(), a.next()]
    const streamB = [b.next(), b.next(), b.next()]
    expect(streamA).toEqual(streamB)
    expect(streamA[0]).not.toBe(streamA[1])
  })
})

describe("applyAction replay", () => {
  it("draws the same cards when the action list and seed match", () => {
    const opening = [
      card({ instanceId: "h1", zone: PLAY_ZONE.hand, name: "Keep" }),
      card({ instanceId: "l1", zone: PLAY_ZONE.library, name: "Top" }),
      card({ instanceId: "l2", zone: PLAY_ZONE.library, name: "Next" }),
      card({
        instanceId: "opp-lib",
        zone: PLAY_ZONE.library,
        owner: "p2",
        name: "Secret",
      }),
    ]
    const seed = 99
    const actions: SessionAction[] = [
      { t: "sh", seat: "p1" },
      { t: "dr", seat: "p1", n: 1 },
    ]
    const once = applyActions(
      createPlaySessionState({ cards: opening, rng: seed }),
      actions
    )
    const twice = applyActions(
      createPlaySessionState({ cards: opening, rng: seed }),
      actions
    )
    expect(once.cards.map((c) => `${c.instanceId}:${c.zone}`)).toEqual(
      twice.cards.map((c) => `${c.instanceId}:${c.zone}`)
    )
    expect(once.seq).toBe(2)
    expect(
      once.cards.find((c) => c.instanceId === "opp-lib")?.zone
    ).toBe(PLAY_ZONE.library)
  })

  it("does not steal another seat's library when shuffling", () => {
    const cards = [
      card({ instanceId: "p2-a", zone: PLAY_ZONE.library, owner: "p2" }),
      card({ instanceId: "p1-a", zone: PLAY_ZONE.library }),
      card({ instanceId: "p1-b", zone: PLAY_ZONE.library }),
    ]
    const next = applyAction(
      createPlaySessionState({ cards, rng: 7 }),
      { t: "sh", seat: "p1" }
    )
    expect(libraryCardsInOrder(next.cards, "p2").map((c) => c.instanceId)).toEqual(
      ["p2-a"]
    )
  })

  it("mints stable copy ids from nextId instead of Date.now", () => {
    const cards = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        x: 10,
        y: 10,
      }),
    ]
    const next = applyAction(createPlaySessionState({ cards, nextId: 4 }), {
      t: "cp",
      i: ["a"],
    })
    expect(next.cards.map((c) => c.instanceId)).toEqual(["a", "copy-4"])
    expect(next.nextId).toBe(5)
    expect(next.cards[1]?.owner).toBe("p1")
  })

  it("sel replaces only that seat's selection", () => {
    const cards = [
      card({ instanceId: "p1-a", zone: PLAY_ZONE.stockpile, selected: true }),
      card({ instanceId: "p1-b", zone: PLAY_ZONE.stockpile }),
      card({
        instanceId: "p2-a",
        zone: PLAY_ZONE.stockpile,
        owner: "p2",
        selected: true,
      }),
    ]
    const next = applyAction(createPlaySessionState({ cards }), {
      t: "sel",
      seat: "p1",
      i: ["p1-b"],
    })
    expect(next.cards.find((c) => c.instanceId === "p1-a")?.selected).toBe(
      false
    )
    expect(next.cards.find((c) => c.instanceId === "p1-b")?.selected).toBe(true)
    expect(next.cards.find((c) => c.instanceId === "p2-a")?.selected).toBe(true)
  })

  it("viewFor strips selection on public opponent cards", () => {
    const cards = [
      card({
        instanceId: "p1-a",
        zone: PLAY_ZONE.stockpile,
        selected: true,
      }),
    ]
    const next = applyAction(createPlaySessionState({ cards }), {
      t: "sel",
      seat: "p1",
      i: ["p1-a"],
    })
    const guestView = viewFor("p2", next)
    const seen = materializeFog(guestView).find((c) => c.instanceId === "p1-a")
    expect(seen?.selected).toBe(false)
  })
})

describe("viewFor fog", () => {
  it("never gives p2 p1 library instance ids or names", () => {
    const state = createPlaySessionState({
      cards: [
        card({
          instanceId: "p1-lib-secret",
          zone: PLAY_ZONE.library,
          name: "Ancestral Recall",
        }),
        card({ instanceId: "p1-hand", zone: PLAY_ZONE.hand, name: "Bolt" }),
        card({
          instanceId: "p1-bf",
          zone: PLAY_ZONE.battlefield,
          name: "Bear",
          x: 8,
          y: 8,
        }),
        card({
          instanceId: "p2-lib",
          zone: PLAY_ZONE.library,
          owner: "p2",
          name: "Mine",
        }),
      ],
      life: seatRecord(20, 18),
    })
    const view = viewFor("p2", state)
    const blob = JSON.stringify(view)
    expect(blob).not.toContain("p1-lib-secret")
    expect(blob).not.toContain("Ancestral Recall")
    expect(blob).not.toContain("Bolt")
    expect(view.libraryCount.p1).toBe(1)
    expect(view.handCount.p1).toBe(1)
    expect(view.cards.some((c) => !isFogStub(c) && c.instanceId === "p1-bf")).toBe(
      true
    )
    expect(
      view.cards.some((c) => !isFogStub(c) && c.instanceId === "p2-lib")
    ).toBe(true)
  })

  it("stubs opponent face-down public cards", () => {
    const state = createPlaySessionState({
      cards: [
        card({
          instanceId: "facedown",
          zone: PLAY_ZONE.battlefield,
          name: "Secret Bear",
          faceDown: true,
          x: 3,
          y: 4,
        }),
      ],
    })
    const view = viewFor("p2", state)
    const stub = view.cards[0]
    expect(isFogStub(stub!)).toBe(true)
    if (isFogStub(stub!)) {
      expect(stub.instanceId).toBe("facedown")
      expect(stub.x).toBe(3)
    }
    expect(JSON.stringify(view)).not.toContain("Secret Bear")
  })

  it("materializeFog pads opponent hand backs without leaking names", () => {
    const state = createPlaySessionState({
      cards: [
        card({ instanceId: "p1-h", zone: PLAY_ZONE.hand, name: "Bolt" }),
        card({ instanceId: "p1-l", zone: PLAY_ZONE.library, name: "Secret" }),
        card({
          instanceId: "p2-h",
          zone: PLAY_ZONE.hand,
          owner: "p2",
          name: "Guest",
        }),
      ],
    })
    const view = viewFor("p2", state)
    const cards = materializeFog(view)
    expect(cards.some((c) => c.name === "Secret")).toBe(false)
    expect(cards.filter((c) => c.zone === PLAY_ZONE.hand && c.owner === "p1")).toHaveLength(1)
    expect(cards.find((c) => c.instanceId === "p2-h")?.name).toBe("Guest")
  })
})
