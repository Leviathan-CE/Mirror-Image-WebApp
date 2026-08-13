import { describe, expect, it } from "vitest"

import { PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import {
  adjustCardCounter,
  CARD_COUNTER_FIELD,
  cardsInZone,
  duplicatePlayingCard,
  duplicatePlayingCards,
  extractStockpileTimeCompletions,
  readyBattlefieldAndStockpile,
  selectableActionTargets,
  deckEntryToPlayInstance,
  setCardsFaceDown,
  toggleExpended,
  toggleFaceDown,
  type CardCounterField,
  type CardCounterKind,
  type PlayingCardInstance,
} from "@/components/Playtester/playCard.logic"

function card(
  overrides: Partial<PlayingCardInstance> &
    Pick<PlayingCardInstance, "instanceId" | "zone">
): PlayingCardInstance {
  return {
    cardId: overrides.cardId ?? 1,
    name: overrides.name ?? "Test Card",
    artPath: overrides.artPath ?? null,
    cost: overrides.cost ?? [],
    expended: overrides.expended ?? false,
    selected: overrides.selected,
    faceDown: overrides.faceDown,
    isToken: overrides.isToken,
    timeCounters: overrides.timeCounters,
    damageCounters: overrides.damageCounters,
    tlvCounters: overrides.tlvCounters,
    tlvMinusCounters: overrides.tlvMinusCounters,
    x: overrides.x,
    y: overrides.y,
    ...overrides,
  }
}

describe("toggleFaceDown / setCardsFaceDown", () => {
  it("toggles a single card", () => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.hand, faceDown: false })]
    const next = toggleFaceDown(cards, "a")
    expect(next[0]?.faceDown).toBe(true)
    expect(toggleFaceDown(next, "a")[0]?.faceDown).toBe(false)
  })

  it("sets many cards to one shared face state (multi-select)", () => {
    const cards = [
      card({ instanceId: "a", zone: PLAY_ZONE.hand, faceDown: false, selected: true }),
      card({ instanceId: "b", zone: PLAY_ZONE.battlefield, faceDown: true, selected: true }),
      card({ instanceId: "c", zone: PLAY_ZONE.hand, faceDown: false, selected: false }),
    ]
    const next = setCardsFaceDown(cards, ["a", "b"], true)
    expect(next.find((c) => c.instanceId === "a")?.faceDown).toBe(true)
    expect(next.find((c) => c.instanceId === "b")?.faceDown).toBe(true)
    expect(next.find((c) => c.instanceId === "c")?.faceDown).toBe(false)
  })
})

describe("selectableActionTargets", () => {
  it("returns only the focus card when it is not selected", () => {
    const focus = card({
      instanceId: "a",
      zone: PLAY_ZONE.hand,
      selected: false,
    })
    const cards = [
      focus,
      card({ instanceId: "b", zone: PLAY_ZONE.hand, selected: true }),
    ]
    expect(selectableActionTargets(cards, focus)).toEqual(["a"])
  })

  it("returns all selected selectable-zone cards when focus is selected", () => {
    const focus = card({
      instanceId: "a",
      zone: PLAY_ZONE.hand,
      selected: true,
    })
    const cards = [
      focus,
      card({ instanceId: "b", zone: PLAY_ZONE.battlefield, selected: true }),
      card({ instanceId: "c", zone: PLAY_ZONE.stockpile, selected: true }),
      card({ instanceId: "d", zone: PLAY_ZONE.pilot, selected: true }),
      card({ instanceId: "e", zone: PLAY_ZONE.hand, selected: false }),
    ]
    expect(selectableActionTargets(cards, focus).sort()).toEqual([
      "a",
      "b",
      "c",
    ])
  })
})

describe("readyBattlefieldAndStockpile", () => {
  it("readies BF/stockpile cards with no time counters", () => {
    const cards = [
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        expended: true,
        selected: true,
      }),
      card({ instanceId: "sp", zone: PLAY_ZONE.stockpile, expended: true }),
      card({ instanceId: "pilot", zone: PLAY_ZONE.pilot, expended: true }),
      card({ instanceId: "hand", zone: PLAY_ZONE.hand, expended: true }),
    ]
    const next = readyBattlefieldAndStockpile(cards)
    expect(next.find((c) => c.instanceId === "bf")?.expended).toBe(false)
    expect(next.find((c) => c.instanceId === "bf")?.selected).toBe(false)
    expect(next.find((c) => c.instanceId === "sp")?.expended).toBe(false)
    expect(next.find((c) => c.instanceId === "pilot")?.expended).toBe(false)
    expect(next.find((c) => c.instanceId === "hand")?.expended).toBe(true)
  })

  it("keeps cards that still hold a time counter expended, and ticks by 1", () => {
    const cards = [
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        expended: true,
        selected: true,
        timeCounters: 2,
      }),
      card({
        instanceId: "sp",
        zone: PLAY_ZONE.stockpile,
        expended: true,
        timeCounters: 1,
      }),
      card({
        instanceId: "hand",
        zone: PLAY_ZONE.hand,
        expended: true,
        timeCounters: 3,
      }),
    ]
    const next = readyBattlefieldAndStockpile(cards)
    const bf = next.find((c) => c.instanceId === "bf")!
    const sp = next.find((c) => c.instanceId === "sp")!
    const hand = next.find((c) => c.instanceId === "hand")!
    expect(bf.expended).toBe(true)
    expect(bf.selected).toBe(false)
    expect(bf.timeCounters).toBe(1)
    expect(sp.expended).toBe(true)
    expect(sp.timeCounters).toBe(0)
    expect(hand.expended).toBe(true)
    expect(hand.timeCounters).toBe(3)
  })

  it("readies a card on the turn after its last counter is removed", () => {
    const cards = [
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        expended: true,
        timeCounters: 1,
      }),
    ]
    const thisTurn = readyBattlefieldAndStockpile(cards)
    expect(thisTurn[0]?.expended).toBe(true)
    expect(thisTurn[0]?.timeCounters).toBe(0)

    const nextTurn = readyBattlefieldAndStockpile(thisTurn)
    expect(nextTurn[0]?.expended).toBe(false)
    expect(nextTurn[0]?.timeCounters).toBe(0)
  })

  it("leaves a waiting card ready if it was not expended", () => {
    const cards = [
      card({
        instanceId: "sp",
        zone: PLAY_ZONE.stockpile,
        expended: false,
        timeCounters: 2,
      }),
    ]
    const next = readyBattlefieldAndStockpile(cards)
    expect(next[0]?.expended).toBe(false)
    expect(next[0]?.timeCounters).toBe(1)
  })
})

describe("extractStockpileTimeCompletions", () => {
  it("pulls stockpile cards that just hit 0 time for launch", () => {
    const before = [
      card({
        instanceId: "done",
        zone: PLAY_ZONE.stockpile,
        expended: true,
        timeCounters: 1,
        x: 10,
        y: 20,
      }),
      card({
        instanceId: "still",
        zone: PLAY_ZONE.stockpile,
        expended: true,
        timeCounters: 2,
      }),
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        expended: true,
        timeCounters: 1,
      }),
    ]
    const after = readyBattlefieldAndStockpile(before)
    const { cards, launching } = extractStockpileTimeCompletions(before, after)

    expect(launching.map((c) => c.instanceId)).toEqual(["done"])
    expect(launching[0]?.timeCounters).toBe(0)
    expect(launching[0]?.expended).toBe(true)
    expect(cards.map((c) => c.instanceId).sort()).toEqual(["bf", "still"])
    expect(cards.find((c) => c.instanceId === "still")?.timeCounters).toBe(1)
    expect(cards.find((c) => c.instanceId === "bf")?.zone).toBe(
      PLAY_ZONE.battlefield
    )
  })

  it("ignores cards already at 0 and non-stockpile zones", () => {
    const before = [
      card({
        instanceId: "idle",
        zone: PLAY_ZONE.stockpile,
        timeCounters: 0,
      }),
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        timeCounters: 1,
      }),
    ]
    const after = [
      card({
        instanceId: "idle",
        zone: PLAY_ZONE.stockpile,
        timeCounters: 0,
      }),
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        timeCounters: 0,
        expended: true,
      }),
    ]
    const { cards, launching } = extractStockpileTimeCompletions(before, after)
    expect(launching).toEqual([])
    expect(cards.map((c) => c.instanceId)).toEqual(["idle", "bf"])
  })

  it("works for a manual -1 time adjust on the last counter", () => {
    const before = [
      card({
        instanceId: "sp",
        zone: PLAY_ZONE.stockpile,
        expended: true,
        timeCounters: 1,
      }),
    ]
    const after = adjustCardCounter(before, "sp", "time", -1)
    const { cards, launching } = extractStockpileTimeCompletions(before, after)
    expect(launching).toHaveLength(1)
    expect(launching[0]?.instanceId).toBe("sp")
    expect(cards).toEqual([])
  })
})

describe("adjustCardCounter", () => {
  it("adds and never goes below 0", () => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.battlefield })]
    const up = adjustCardCounter(cards, "a", "damage", 2)
    expect(up[0]?.damageCounters).toBe(2)
    const down = adjustCardCounter(up, "a", "damage", -5)
    expect(down[0]?.damageCounters).toBe(0)
  })

  it.each(
    Object.entries(CARD_COUNTER_FIELD) as Array<
      [CardCounterKind, CardCounterField]
    >
  )("routes the %s kind to %s only", (kind, field) => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.battlefield })]
    const next = adjustCardCounter(cards, "a", kind, 3)[0]!
    expect(next[field]).toBe(3)

    const others = Object.values(CARD_COUNTER_FIELD).filter(
      (other) => other !== field
    )
    for (const other of others) {
      expect(next[other] ?? undefined).toBeUndefined()
    }
  })

  it("cancels +TLV against −1 TLV when adding either", () => {
    const withTlv = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        tlvCounters: 2,
      }),
    ]
    const afterMinus = adjustCardCounter(withTlv, "a", "tlvMinus", 1)[0]!
    expect(afterMinus.tlvCounters).toBe(1)
    expect(afterMinus.tlvMinusCounters).toBeUndefined()

    const withMinus = [
      card({
        instanceId: "b",
        zone: PLAY_ZONE.battlefield,
        tlvMinusCounters: 2,
      }),
    ]
    const afterPlus = adjustCardCounter(withMinus, "b", "tlv", 1)[0]!
    expect(afterPlus.tlvMinusCounters).toBe(1)
    expect(afterPlus.tlvCounters).toBeUndefined()
  })

  it("stacks −1 TLV when there is no +TLV to cancel", () => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.battlefield })]
    const next = adjustCardCounter(cards, "a", "tlvMinus", 2)[0]!
    expect(next.tlvMinusCounters).toBe(2)
    expect(next.tlvCounters).toBeUndefined()
  })
})

describe("cardsInZone / toggleExpended / duplicatePlayingCard", () => {
  it("filters by zone", () => {
    const cards = [
      card({ instanceId: "a", zone: PLAY_ZONE.hand }),
      card({ instanceId: "b", zone: PLAY_ZONE.library }),
    ]
    expect(cardsInZone(cards, PLAY_ZONE.hand).map((c) => c.instanceId)).toEqual([
      "a",
    ])
  })

  it("toggles expended", () => {
    const cards = [
      card({ instanceId: "a", zone: PLAY_ZONE.battlefield, expended: false }),
    ]
    expect(toggleExpended(cards, "a")[0]?.expended).toBe(true)
  })

  it("duplicates free-float cards as tokens and preserves faceDown", () => {
    const cards = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        x: 10,
        y: 20,
        faceDown: true,
      }),
    ]
    const next = duplicatePlayingCard(cards, "a")
    expect(next).toHaveLength(2)
    const copy = next[1]!
    expect(copy.instanceId).not.toBe("a")
    expect(copy.faceDown).toBe(true)
    expect(copy.isToken).toBe(true)
    expect(copy.x).toBe(38)
    expect(copy.y).toBe(48)
  })

  it("duplicates each selected free-float card", () => {
    const cards = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        x: 0,
        y: 0,
        selected: true,
      }),
      card({
        instanceId: "b",
        zone: PLAY_ZONE.stockpile,
        x: 100,
        y: 40,
        selected: true,
      }),
    ]
    const next = duplicatePlayingCards(cards, ["a", "b"])
    expect(next).toHaveLength(4)
    const copies = next.filter((c) => c.instanceId !== "a" && c.instanceId !== "b")
    expect(copies).toHaveLength(2)
    expect(copies.every((c) => c.isToken)).toBe(true)
    expect(copies.map((c) => c.zone).sort()).toEqual([
      PLAY_ZONE.battlefield,
      PLAY_ZONE.stockpile,
    ])
  })

  it("does not duplicate hand cards", () => {
    const cards = [card({ instanceId: "a", zone: PLAY_ZONE.hand })]
    expect(duplicatePlayingCard(cards, "a")).toBe(cards)
  })
})

describe("deckEntryToPlayInstance classified", () => {
  it("strips art/cost and sets isClassified from the API flag", () => {
    const inst = deckEntryToPlayInstance(
      {
        card_id: 9,
        card_name: "Secret Preview",
        card_art_path: "/art/secret.png",
        card_art_version: 3,
        cost: ["LIF"],
        is_classified: true,
        classification: "classified",
      },
      PLAY_ZONE.hand
    )
    expect(inst.isClassified).toBe(true)
    expect(inst.classification).toBe("classified")
    expect(inst.artPath).toBeNull()
    expect(inst.artVersion).toBeNull()
    expect(inst.cost).toEqual([])
    expect(inst.name).toBe("Secret Preview")
  })

  it("maps top_secret unpublished stubs", () => {
    const inst = deckEntryToPlayInstance(
      {
        card_id: 10,
        card_name: "Unreleased",
        card_art_path: "/art/x.png",
        is_classified: true,
        classification: "top_secret",
      },
      PLAY_ZONE.hand
    )
    expect(inst.classification).toBe("top_secret")
    expect(inst.isClassified).toBe(true)
    expect(inst.artPath).toBeNull()
  })
})
