import { describe, expect, it } from "vitest"

import { PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/playCard.logic"
import {
  moveToHand,
  moveToPilot,
  putCardOnBattlefield,
  putCardOnLibraryBottom,
  putCardOnLibraryTop,
  putCardOnStockpile,
  putCardsOnLibraryBottom,
  takeTopLibraryCard,
} from "@/components/Playtester/zoneMoves.logic"

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

describe("takeTopLibraryCard", () => {
  it("removes the first library card and returns it", () => {
    const cards = [
      card({ instanceId: "top", zone: PLAY_ZONE.library, name: "Top" }),
      card({ instanceId: "bot", zone: PLAY_ZONE.library, name: "Bot" }),
      card({ instanceId: "h", zone: PLAY_ZONE.hand }),
    ]
    const taken = takeTopLibraryCard(cards)
    expect(taken?.drawn.instanceId).toBe("top")
    expect(taken?.cards.map((c) => c.instanceId)).toEqual(["bot", "h"])
  })

  it("returns null when library is empty", () => {
    expect(
      takeTopLibraryCard([card({ instanceId: "h", zone: PLAY_ZONE.hand })])
    ).toBeNull()
  })
})

describe("library put top / bottom", () => {
  it("putCardOnLibraryTop inserts before existing library cards", () => {
    const base = [
      card({ instanceId: "h", zone: PLAY_ZONE.hand }),
      card({ instanceId: "old", zone: PLAY_ZONE.library }),
    ]
    const flying = card({ instanceId: "new", zone: PLAY_ZONE.battlefield })
    const next = putCardOnLibraryTop(base, flying)
    const lib = next.filter((c) => c.zone === PLAY_ZONE.library)
    expect(lib.map((c) => c.instanceId)).toEqual(["new", "old"])
  })

  it("putCardOnLibraryBottom appends after library cards", () => {
    const base = [card({ instanceId: "old", zone: PLAY_ZONE.library })]
    const flying = card({ instanceId: "new", zone: PLAY_ZONE.hand })
    const next = putCardOnLibraryBottom(base, flying)
    expect(
      next.filter((c) => c.zone === PLAY_ZONE.library).map((c) => c.instanceId)
    ).toEqual(["old", "new"])
  })

  it("putCardsOnLibraryBottom destroys resource tokens", () => {
    const cards = [
      card({
        instanceId: "tim",
        zone: PLAY_ZONE.stockpile,
        isResourceToken: true,
      }),
      card({ instanceId: "u", zone: PLAY_ZONE.hand }),
    ]
    const next = putCardsOnLibraryBottom(cards, ["tim", "u"])
    expect(next.map((c) => c.instanceId)).toEqual(["u"])
    expect(next[0]?.zone).toBe(PLAY_ZONE.library)
  })
})

describe("battlefield / stockpile seating preserves faceDown", () => {
  it("putCardOnBattlefield keeps faceDown from the flying card", () => {
    const flying = card({
      instanceId: "a",
      zone: PLAY_ZONE.library,
      faceDown: true,
    })
    const next = putCardOnBattlefield([], flying, 12, 34)
    expect(next[0]).toMatchObject({
      instanceId: "a",
      zone: PLAY_ZONE.battlefield,
      x: 12,
      y: 34,
      faceDown: true,
    })
  })

  it("putCardOnStockpile keeps faceDown", () => {
    const flying = card({
      instanceId: "a",
      zone: PLAY_ZONE.library,
      faceDown: true,
    })
    const next = putCardOnStockpile([], flying, 5, 6)
    expect(next[0]?.faceDown).toBe(true)
    expect(next[0]?.zone).toBe(PLAY_ZONE.stockpile)
  })
})

describe("moveToHand destroys resource tokens", () => {
  it("removes a resource instead of seating it in hand", () => {
    const cards = [
      card({
        instanceId: "tim",
        zone: PLAY_ZONE.stockpile,
        isResourceToken: true,
      }),
    ]
    const next = moveToHand(cards, "tim")
    expect(next).toEqual([])
  })
})

describe("moveToPilot", () => {
  it("seats the card and bumps an existing pilot to hand", () => {
    const cards = [
      card({ instanceId: "old", zone: PLAY_ZONE.pilot, name: "Old Pilot" }),
      card({ instanceId: "new", zone: PLAY_ZONE.hand, name: "New Pilot" }),
    ]
    const next = moveToPilot(cards, "new")
    expect(next.find((c) => c.instanceId === "new")?.zone).toBe(PLAY_ZONE.pilot)
    expect(next.find((c) => c.instanceId === "old")?.zone).toBe(PLAY_ZONE.hand)
  })

  it("destroys a resource targeting pilot", () => {
    const cards = [
      card({
        instanceId: "tim",
        zone: PLAY_ZONE.stockpile,
        isResourceToken: true,
      }),
    ]
    expect(moveToPilot(cards, "tim")).toEqual([])
  })
})
