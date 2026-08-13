import { describe, expect, it } from "vitest"

import {
  PLAY_ZONE,
  type PlayZone,
} from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/playCard.logic"
import {
  moveToBattlefield,
  moveToDismantled,
  moveToHand,
  moveToPilot,
  moveToStockpile,
  moveToTrashyard,
  putCardInDismantled,
  putCardInHand,
  putCardInTrashyard,
  putCardOnBattlefield,
  putCardOnLibraryBottom,
  putCardOnLibraryTop,
  putCardOnPilot,
  putCardOnStockpile,
  putCardsOnLibraryBottom,
  moveAllFromZone,
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

describe("counters do not survive a zone change", () => {
  const COUNTERS = {
    timeCounters: 2,
    damageCounters: 3,
    tlvCounters: 1,
    tlvMinusCounters: 2,
    genericCounters: 4,
    depletionCounters: 5,
  }
  const CLEARED = {
    timeCounters: undefined,
    damageCounters: undefined,
    tlvCounters: undefined,
    tlvMinusCounters: undefined,
    genericCounters: undefined,
    depletionCounters: undefined,
  }

  function counted(
    overrides: Partial<PlayingCardInstance> &
      Pick<PlayingCardInstance, "instanceId" | "zone">
  ): PlayingCardInstance {
    return card({ ...COUNTERS, ...overrides })
  }

  function countersOf(target: PlayingCardInstance | undefined) {
    return {
      timeCounters: target?.timeCounters,
      damageCounters: target?.damageCounters,
      tlvCounters: target?.tlvCounters,
      tlvMinusCounters: target?.tlvMinusCounters,
      genericCounters: target?.genericCounters,
      depletionCounters: target?.depletionCounters,
    }
  }

  const moves: Array<{
    name: string
    from: PlayZone
    run: (cards: PlayingCardInstance[]) => PlayingCardInstance[]
  }> = [
    {
      name: "moveToBattlefield",
      from: PLAY_ZONE.hand,
      run: (cards) => moveToBattlefield(cards, "a", 1, 2),
    },
    {
      name: "moveToStockpile",
      from: PLAY_ZONE.battlefield,
      run: (cards) => moveToStockpile(cards, "a", 1, 2),
    },
    {
      name: "moveToHand",
      from: PLAY_ZONE.battlefield,
      run: (cards) => moveToHand(cards, "a"),
    },
    {
      name: "moveToTrashyard",
      from: PLAY_ZONE.battlefield,
      run: (cards) => moveToTrashyard(cards, "a"),
    },
    {
      name: "moveToDismantled",
      from: PLAY_ZONE.battlefield,
      run: (cards) => moveToDismantled(cards, "a"),
    },
    {
      name: "moveToPilot",
      from: PLAY_ZONE.hand,
      run: (cards) => moveToPilot(cards, "a"),
    },
  ]

  it.each(moves)("$name clears every counter", ({ from, run }) => {
    const next = run([counted({ instanceId: "a", zone: from })])
    expect(countersOf(next.find((c) => c.instanceId === "a"))).toEqual(CLEARED)
  })

  // `from` mirrors where each seating helper is really called from: draw and
  // degrade animations hand it a card taken off the library, while the deck
  // put-backs receive one from hand or the battlefield.
  const seatings: Array<{
    name: string
    from: PlayZone
    run: (flying: PlayingCardInstance) => PlayingCardInstance[]
  }> = [
    {
      name: "putCardInHand",
      from: PLAY_ZONE.library,
      run: (flying) => putCardInHand([], flying),
    },
    {
      name: "putCardOnLibraryTop",
      from: PLAY_ZONE.battlefield,
      run: (flying) => putCardOnLibraryTop([], flying),
    },
    {
      name: "putCardOnLibraryBottom",
      from: PLAY_ZONE.hand,
      run: (flying) => putCardOnLibraryBottom([], flying),
    },
    {
      name: "putCardInTrashyard",
      from: PLAY_ZONE.library,
      run: (flying) => putCardInTrashyard([], flying),
    },
    {
      name: "putCardInDismantled",
      from: PLAY_ZONE.library,
      run: (flying) => putCardInDismantled([], flying),
    },
    {
      name: "putCardOnBattlefield",
      from: PLAY_ZONE.library,
      run: (flying) => putCardOnBattlefield([], flying, 1, 2),
    },
    {
      name: "putCardOnStockpile",
      from: PLAY_ZONE.library,
      run: (flying) => putCardOnStockpile([], flying, 1, 2),
    },
    {
      name: "putCardOnPilot",
      from: PLAY_ZONE.library,
      run: (flying) => putCardOnPilot([], flying),
    },
  ]

  it.each(seatings)("$name clears every counter", ({ from, run }) => {
    const next = run(counted({ instanceId: "a", zone: from }))
    expect(countersOf(next.find((c) => c.instanceId === "a"))).toEqual(CLEARED)
  })

  it("keeps counters when repositioning inside the battlefield", () => {
    const cards = [counted({ instanceId: "a", zone: PLAY_ZONE.battlefield })]
    const next = moveToBattlefield(cards, "a", 40, 50)
    expect(countersOf(next[0])).toEqual(COUNTERS)
    expect(next[0]).toMatchObject({ x: 40, y: 50 })
  })

  it("keeps counters when repositioning inside the stockpile", () => {
    const cards = [counted({ instanceId: "a", zone: PLAY_ZONE.stockpile })]
    expect(countersOf(moveToStockpile(cards, "a", 8, 9)[0])).toEqual(COUNTERS)
  })

  it("clears counters on a pilot bumped back to hand", () => {
    const cards = [
      counted({ instanceId: "old", zone: PLAY_ZONE.pilot }),
      card({ instanceId: "new", zone: PLAY_ZONE.hand }),
    ]
    const next = moveToPilot(cards, "new")
    expect(countersOf(next.find((c) => c.instanceId === "old"))).toEqual(CLEARED)
  })

  it("clears counters on a pilot bumped to hand while seating a flyer", () => {
    const next = putCardOnPilot(
      [counted({ instanceId: "old", zone: PLAY_ZONE.pilot })],
      card({ instanceId: "new", zone: PLAY_ZONE.library })
    )
    expect(countersOf(next.find((c) => c.instanceId === "old"))).toEqual(CLEARED)
  })
})

describe("expended persists across in-play zones", () => {
  it("keeps expended when moving battlefield ↔ stockpile", () => {
    const onBf = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        expended: true,
      }),
    ]
    const toSp = moveToStockpile(onBf, "a", 8, 9)
    expect(toSp[0]?.expended).toBe(true)
    expect(toSp[0]?.zone).toBe(PLAY_ZONE.stockpile)

    const back = moveToBattlefield(toSp, "a", 1, 2)
    expect(back[0]?.expended).toBe(true)
    expect(back[0]?.zone).toBe(PLAY_ZONE.battlefield)
  })

  it("readies when leaving in play for hand", () => {
    const cards = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        expended: true,
      }),
    ]
    expect(moveToHand(cards, "a")[0]?.expended).toBe(false)
  })

  it("readies when entering battlefield from hand", () => {
    const cards = [
      card({ instanceId: "a", zone: PLAY_ZONE.hand, expended: true }),
    ]
    expect(moveToBattlefield(cards, "a", 0, 0)[0]?.expended).toBe(false)
  })

  it("readies when seating from library onto stockpile", () => {
    const flying = card({
      instanceId: "a",
      zone: PLAY_ZONE.library,
      expended: true,
    })
    expect(putCardOnStockpile([], flying, 1, 2)[0]?.expended).toBe(false)
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

  it("is a no-op when the card is already seated (keeps expended)", () => {
    const cards = [
      card({
        instanceId: "pilot",
        zone: PLAY_ZONE.pilot,
        expended: true,
      }),
    ]
    const next = moveToPilot(cards, "pilot")
    expect(next).toBe(cards)
    expect(next[0]?.expended).toBe(true)
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

describe("moveAllFromZone", () => {
  it("moves every trashyard card onto the library top, keeping pile order", () => {
    const cards = [
      card({ instanceId: "lib", zone: PLAY_ZONE.library, cardId: 9 }),
      card({ instanceId: "t-bottom", zone: PLAY_ZONE.trashyard, cardId: 1 }),
      card({ instanceId: "t-top", zone: PLAY_ZONE.trashyard, cardId: 2 }),
      card({ instanceId: "hand", zone: PLAY_ZONE.hand, cardId: 3 }),
    ]
    const next = moveAllFromZone(cards, PLAY_ZONE.trashyard, PLAY_ZONE.library)
    expect(next.filter((c) => c.zone === PLAY_ZONE.trashyard)).toEqual([])
    const libIds = next
      .filter((c) => c.zone === PLAY_ZONE.library)
      .map((c) => c.instanceId)
    // Bottom of trash placed first, then top — so former top remains top.
    expect(libIds).toEqual(["t-top", "t-bottom", "lib"])
    expect(next.find((c) => c.instanceId === "hand")?.zone).toBe(PLAY_ZONE.hand)
  })

  it("omits a no-op when destination matches source", () => {
    const cards = [
      card({ instanceId: "t1", zone: PLAY_ZONE.trashyard }),
    ]
    expect(
      moveAllFromZone(cards, PLAY_ZONE.trashyard, PLAY_ZONE.trashyard)
    ).toBe(cards)
  })

  it("moves dismantled cards to trashyard and trash to dismantled", () => {
    const cards = [
      card({ instanceId: "d1", zone: PLAY_ZONE.dismantled, cardId: 1 }),
      card({ instanceId: "d2", zone: PLAY_ZONE.dismantled, cardId: 2 }),
    ]
    const toTrash = moveAllFromZone(
      cards,
      PLAY_ZONE.dismantled,
      PLAY_ZONE.trashyard
    )
    expect(toTrash.map((c) => c.zone)).toEqual([
      PLAY_ZONE.trashyard,
      PLAY_ZONE.trashyard,
    ])

    const trashCards = [
      card({ instanceId: "t1", zone: PLAY_ZONE.trashyard, cardId: 1 }),
      card({ instanceId: "t2", zone: PLAY_ZONE.trashyard, cardId: 2 }),
    ]
    const toDismantled = moveAllFromZone(
      trashCards,
      PLAY_ZONE.trashyard,
      PLAY_ZONE.dismantled
    )
    expect(toDismantled.every((c) => c.zone === PLAY_ZONE.dismantled)).toBe(
      true
    )
  })

  it("moves every library card to the trashyard (top mills first)", () => {
    const cards = [
      card({ instanceId: "top", zone: PLAY_ZONE.library, cardId: 1 }),
      card({ instanceId: "bottom", zone: PLAY_ZONE.library, cardId: 2 }),
    ]
    const next = moveAllFromZone(
      cards,
      PLAY_ZONE.library,
      PLAY_ZONE.trashyard
    )
    expect(next.filter((c) => c.zone === PLAY_ZONE.library)).toEqual([])
    expect(
      next.filter((c) => c.zone === PLAY_ZONE.trashyard).map((c) => c.instanceId)
    ).toEqual(["top", "bottom"])
  })
})
