/**
 * Smoke-style flows: multi-step sequences that mirror playtester actions
 * (create copy, zone moves, start turn, mulligan, accumulate).
 * Pure logic only — no React / DOM.
 */

import { describe, expect, it } from "vitest"

import {
  spawnResourceTokenInstance,
  type ResourceColor,
} from "@/components/Playtester/session/accumulateResources.logic"
import { PLAY_ZONE } from "@/components/Playtester/constants"
import {
  cardsInZone,
  duplicatePlayingCards,
  extractStockpileTimeCompletions,
  readyBattlefieldAndStockpile,
  removeCard,
  selectableActionTargets,
  type PlayingCardInstance,
} from "@/components/Playtester/session/playCard.logic"
import { applyMulliganToBottom } from "@/components/Playtester/session/setupOpeningSession.logic"
import {
  moveToBattlefield,
  moveToHand,
  moveToStockpile,
  putCardInHand,
  putCardOnBattlefield,
  putCardOnLibraryBottom,
  putCardsOnLibraryBottom,
  takeTopLibraryCard,
} from "@/components/Playtester/drag/zoneMoves.logic"
import type { CardLibraryItem } from "@/lib/api/cards"

function card(
  overrides: Partial<PlayingCardInstance> &
    Pick<PlayingCardInstance, "instanceId" | "zone">
): PlayingCardInstance {
  return {
    cardId: overrides.cardId ?? 1,
    name: overrides.name ?? "Card",
    artPath: null,
    cost: [],
    owner: "p1" as const,
    expended: false,
    ...overrides,
  }
}

function resourceTemplate(
  id: number,
  name: string,
  cost: string[]
): CardLibraryItem {
  return {
    id,
    card_name: name,
    card_set_name: "set",
    rarity: "common",
    invoke_cost: 0,
    cost,
    super_types: ["Resource"],
    sub_types: [],
    types_line: "Resource Token",
    description: "",
    keywords: [],
    show_help_text: true,
    threat_level: "0",
    card_art_path: null,
    card_art_version: null,
  }
}

/**
 * Start-of-turn draw plan (same rules as usePlaySession.startTurn):
 * draw 1 from library when possible; otherwise lose 1 life.
 */
function planStartTurnDraw(cards: PlayingCardInstance[]): {
  drawCount: number
  lifeLoss: number
} {
  const libraryCount = cardsInZone(cards, PLAY_ZONE.library).length
  if (libraryCount > 0) return { drawCount: 1, lifeLoss: 0 }
  return { drawCount: 0, lifeLoss: 1 }
}

function drawTopToHand(
  cards: PlayingCardInstance[],
  count: number
): PlayingCardInstance[] {
  let next = cards
  for (let i = 0; i < count; i++) {
    const taken = takeTopLibraryCard(next)
    if (!taken) break
    next = putCardInHand(taken.cards, taken.drawn)
  }
  return next
}

describe("smoke: multi-select Create copy → tokens die leaving play", () => {
  it("duplicates each selected card as tokens; moving copies to hand destroys them", () => {
    const start = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        x: 0,
        y: 0,
        selected: true,
        name: "Unit A",
      }),
      card({
        instanceId: "b",
        zone: PLAY_ZONE.stockpile,
        x: 40,
        y: 10,
        selected: true,
        name: "Unit B",
      }),
    ]

    // Context menu uses selectableActionTargets when focus is selected.
    const targets = selectableActionTargets(start, start[0]!)
    expect(targets.sort()).toEqual(["a", "b"])

    const withCopies = duplicatePlayingCards(start, targets)
    expect(withCopies).toHaveLength(4)
    const copies = withCopies.filter(
      (c) => c.instanceId !== "a" && c.instanceId !== "b"
    )
    expect(copies).toHaveLength(2)
    expect(copies.every((c) => c.isToken)).toBe(true)
    expect(withCopies.find((c) => c.instanceId === "a")?.isToken).toBeFalsy()

    // Drag / move-to-hand each copy — session tokens are destroyed, not seated.
    let next = withCopies
    for (const copy of copies) {
      next = moveToHand(next, copy.instanceId)
    }
    expect(next.map((c) => c.instanceId).sort()).toEqual(["a", "b"])
    expect(cardsInZone(next, PLAY_ZONE.hand)).toHaveLength(0)

    // Originals are still normal cards — they can enter hand.
    next = moveToHand(next, "a")
    expect(cardsInZone(next, PLAY_ZONE.hand).map((c) => c.instanceId)).toEqual([
      "a",
    ])
  })

  it("put on library bottom also destroys created-copy tokens", () => {
    const start = [
      card({
        instanceId: "a",
        zone: PLAY_ZONE.battlefield,
        x: 1,
        y: 1,
      }),
    ]
    const withCopy = duplicatePlayingCards(start, ["a"])
    const copyId = withCopy.find((c) => c.instanceId !== "a")!.instanceId

    const next = putCardsOnLibraryBottom(withCopy, [copyId])
    expect(next.map((c) => c.instanceId)).toEqual(["a"])
  })
})

describe("smoke: resource tokens BF ↔ stockpile live; other zones die", () => {
  it("keeps a resource when moving battlefield ↔ stockpile, destroys into hand", () => {
    let cards = [
      card({
        instanceId: "tim",
        zone: PLAY_ZONE.stockpile,
        x: 5,
        y: 5,
        isToken: true,
        name: "Natural Time",
      }),
    ]

    cards = moveToBattlefield(cards, "tim", 20, 30)
    expect(cards).toHaveLength(1)
    expect(cards[0]?.zone).toBe(PLAY_ZONE.battlefield)
    expect(cards[0]?.isToken).toBe(true)

    cards = moveToStockpile(cards, "tim", 8, 9)
    expect(cards).toHaveLength(1)
    expect(cards[0]?.zone).toBe(PLAY_ZONE.stockpile)

    cards = moveToHand(cards, "tim")
    expect(cards).toHaveLength(0)
  })
})

describe("smoke: start turn ready + stockpile time launch", () => {
  it("readies in-play cards and extracts stockpile cards that just hit 0 time", () => {
    const before = [
      card({
        instanceId: "locked",
        zone: PLAY_ZONE.stockpile,
        expended: true,
        timeCounters: 1,
        x: 12,
        y: 4,
      }),
      card({
        instanceId: "waiting",
        zone: PLAY_ZONE.stockpile,
        expended: true,
        timeCounters: 2,
      }),
      card({
        instanceId: "bf",
        zone: PLAY_ZONE.battlefield,
        expended: true,
      }),
    ]

    const afterReady = readyBattlefieldAndStockpile(before)
    const { cards, launching } = extractStockpileTimeCompletions(
      before,
      afterReady
    )

    expect(launching.map((c) => c.instanceId)).toEqual(["locked"])
    expect(cards.map((c) => c.instanceId).sort()).toEqual(["bf", "waiting"])
    expect(cards.find((c) => c.instanceId === "bf")?.expended).toBe(false)
    expect(cards.find((c) => c.instanceId === "waiting")?.timeCounters).toBe(1)
    expect(cards.find((c) => c.instanceId === "waiting")?.expended).toBe(true)

    // Anim completion seats the launched card onto the battlefield.
    const seated = putCardOnBattlefield(cards, launching[0]!, 40, 50)
    expect(seated.find((c) => c.instanceId === "locked")?.zone).toBe(
      PLAY_ZONE.battlefield
    )
    expect(seated.find((c) => c.instanceId === "locked")?.x).toBe(40)
  })
})

describe("smoke: start turn draw / life loss", () => {
  it("draws one card at start of turn when the library has cards", () => {
    const deck = [
      card({ instanceId: "h1", zone: PLAY_ZONE.hand }),
      card({ instanceId: "l1", zone: PLAY_ZONE.library }),
    ]
    expect(planStartTurnDraw(deck)).toEqual({ drawCount: 1, lifeLoss: 0 })

    const afterDraw = drawTopToHand(deck, 1)
    expect(cardsInZone(afterDraw, PLAY_ZONE.hand)).toHaveLength(2)
    expect(cardsInZone(afterDraw, PLAY_ZONE.library)).toHaveLength(0)
  })

  it("costs 1 life when the library is empty", () => {
    const empty = [card({ instanceId: "h1", zone: PLAY_ZONE.hand })]
    expect(planStartTurnDraw(empty)).toEqual({ drawCount: 0, lifeLoss: 1 })
  })
})

describe("smoke: mulligan", () => {
  it("puts selected hand cards on library bottom and reports redraw count", () => {
    const start = [
      card({ instanceId: "h1", zone: PLAY_ZONE.hand, name: "Keep" }),
      card({ instanceId: "h2", zone: PLAY_ZONE.hand, name: "Mull" }),
      card({ instanceId: "h3", zone: PLAY_ZONE.hand, name: "Mull2" }),
      card({ instanceId: "l1", zone: PLAY_ZONE.library }),
    ]

    const { cards, drawCount } = applyMulliganToBottom(start, ["h2", "h3"])
    expect(drawCount).toBe(2)
    expect(cardsInZone(cards, PLAY_ZONE.hand).map((c) => c.instanceId)).toEqual([
      "h1",
    ])
    const libraryIds = cardsInZone(cards, PLAY_ZONE.library).map(
      (c) => c.instanceId
    )
    // Bottom of library: original l1, then mulliganed cards in selection order.
    expect(libraryIds).toEqual(["l1", "h2", "h3"])

    // Opening redraw after mulligan (same as queueDrawsToHand(drawCount)).
    const redrawn = drawTopToHand(cards, drawCount)
    expect(cardsInZone(redrawn, PLAY_ZONE.hand).map((c) => c.instanceId).sort()).toEqual(
      ["h1", "l1", "h2"].sort()
    )
  })

  it("no-ops when nothing is selected", () => {
    const start = [card({ instanceId: "h1", zone: PLAY_ZONE.hand })]
    expect(applyMulliganToBottom(start, [])).toEqual({
      cards: start,
      drawCount: 0,
    })
  })
})

describe("smoke: accumulate resources", () => {
  it("removes the hand card to library bottom and spawns colour tokens on stockpile", () => {
    const handCard = card({
      instanceId: "pay",
      zone: PLAY_ZONE.hand,
      name: "Pay Cost",
      cost: ["TIM", "LIF"],
    })
    const start = [
      handCard,
      card({ instanceId: "l1", zone: PLAY_ZONE.library }),
    ]

    const colors: ResourceColor[] = ["TIM", "LIF"]
    const templates = new Map<ResourceColor, CardLibraryItem>([
      ["TIM", resourceTemplate(10, "Natural Time", ["TIM"])],
      ["LIF", resourceTemplate(11, "Life", ["LIF"])],
    ])

    // finishAccumulateSpawn + putCardOnLibraryBottom (slide complete).
    let next = removeCard(start, handCard.instanceId)
    colors.forEach((color, index) => {
      const template = templates.get(color)!
      next = [
        ...next,
        spawnResourceTokenInstance(
          template,
          20 + index * 28,
          24 + index * 12,
          index
        ),
      ]
    })
    next = putCardOnLibraryBottom(next, handCard)

    expect(cardsInZone(next, PLAY_ZONE.hand)).toHaveLength(0)
    const stock = cardsInZone(next, PLAY_ZONE.stockpile)
    expect(stock).toHaveLength(2)
    expect(stock.every((c) => c.isToken)).toBe(true)
    expect(stock.map((c) => c.name).sort()).toEqual(["Life", "Natural Time"])

    const libraryIds = cardsInZone(next, PLAY_ZONE.library).map(
      (c) => c.instanceId
    )
    expect(libraryIds).toEqual(["l1", "pay"])
  })
})

describe("smoke: library card from deck search (details-only targets)", () => {
  it("keeps library instances addressable for inspect without zone actions mutating zone", () => {
    const libraryCard = card({
      instanceId: "lib-1",
      zone: PLAY_ZONE.library,
      name: "Searched",
    })
    const cards = [libraryCard]
    // Right-click from deck search focuses a library card; multi-select zones
    // do not apply — selectableActionTargets returns just that id.
    expect(selectableActionTargets(cards, libraryCard)).toEqual(["lib-1"])
    expect(libraryCard.zone).toBe(PLAY_ZONE.library)
  })
})
