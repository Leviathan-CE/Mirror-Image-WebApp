/** Zone transfer helpers (move / put / take) for the playtester session. */

import {
  destroyResourceCardIfLeaving,
  destroyResourceTokenIfLeaving,
  isResourceTokenInstance,
} from "./sessionResources.logic"
import { PLAY_ZONE, type PlayZone } from "./playtesterConstants"
import {
  CARD_COUNTER_FIELD,
  type CardCounterField,
  type PlayingCardInstance,
} from "./playCard.logic"

type CardCounters = Pick<PlayingCardInstance, CardCounterField>

const COUNTER_FIELDS = Object.values(
  CARD_COUNTER_FIELD
) as readonly CardCounterField[]

/**
 * Derived from `CARD_COUNTER_FIELD` rather than written out, so a new counter
 * kind is cleared on zone change without anyone remembering to come here.
 */
const NO_COUNTERS: CardCounters = Object.fromEntries(
  COUNTER_FIELDS.map((field) => [field, undefined])
) as CardCounters

/** Battlefield + stockpile ("in play") — expended persists across these only. */
const IN_PLAY_ZONES: ReadonlySet<PlayZone> = new Set([
  PLAY_ZONE.battlefield,
  PLAY_ZONE.stockpile,
])

/**
 * Counters last only as long as a card stays put: entering a new zone clears
 * every kind of counter. Repositioning inside the same zone keeps them.
 *
 * The pilot's cost increase on defeat is deliberately not covered here — it is
 * session state (`pilotGenBonus`), not a card counter, so it survives every
 * move by construction.
 */
function countersOnEnter(
  card: PlayingCardInstance,
  target: PlayZone
): CardCounters {
  if (card.zone !== target) return NO_COUNTERS
  return Object.fromEntries(
    COUNTER_FIELDS.map((field) => [field, card[field]])
  ) as CardCounters
}

/**
 * Expended survives moves that stay in play (battlefield ↔ stockpile).
 * Leaving in play, or entering from anywhere else, readies the card.
 */
function expendedOnEnter(
  card: PlayingCardInstance,
  target: PlayZone
): boolean {
  if (IN_PLAY_ZONES.has(card.zone) && IN_PLAY_ZONES.has(target)) {
    return Boolean(card.expended)
  }
  return false
}

export function moveToBattlefield(
  cards: PlayingCardInstance[],
  instanceId: string,
  x: number,
  y: number
): PlayingCardInstance[] {
  return cards.map((c) =>
    c.instanceId === instanceId
      ? {
          ...c,
          ...countersOnEnter(c, "battlefield"),
          zone: "battlefield" as const,
          x,
          y,
          expended: expendedOnEnter(c, PLAY_ZONE.battlefield),
          selected: false,
        }
      : c
  )
}

/** Return a battlefield card to hand (clears free-float position). */
export function moveToHand(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  const destroyed = destroyResourceTokenIfLeaving(cards, instanceId, "hand")
  if (destroyed) return destroyed
  return cards.map((c) => {
    if (c.instanceId !== instanceId) return c
    return {
      instanceId: c.instanceId,
      cardId: c.cardId,
      name: c.name,
      artPath: c.artPath,
      artVersion: c.artVersion,
      cost: c.cost ?? [],
      zone: "hand" as const,
      expended: false,
      selected: false,
      isResourceToken: c.isResourceToken,
      ...countersOnEnter(c, "hand"),
    }
  })
}

/**
 * Remove the top library card from the session (first match in array order).
 * Caller holds `drawn` during the flip animation, then puts it in hand.
 */
export function takeTopLibraryCard(
  cards: PlayingCardInstance[]
): { cards: PlayingCardInstance[]; drawn: PlayingCardInstance } | null {
  const top = cards.find((c) => c.zone === "library")
  if (!top) return null
  return {
    cards: cards.filter((c) => c.instanceId !== top.instanceId),
    drawn: { ...top, selected: false },
  }
}

/** Append a card into the hand zone (e.g. after draw animation). */
export function putCardInHand(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroyResourceCardIfLeaving(cards, card, "hand")
  if (destroyed) return destroyed
  return [
    ...cards,
    {
      instanceId: card.instanceId,
      cardId: card.cardId,
      name: card.name,
      artPath: card.artPath,
      artVersion: card.artVersion,
      cost: card.cost ?? [],
      zone: "hand" as const,
      expended: false,
      selected: false,
      isResourceToken: card.isResourceToken,
      ...countersOnEnter(card, "hand"),
    },
  ]
}

/** Remove a card from the session (held in an animation overlay). */
export function putCardOnLibraryTop(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroyResourceCardIfLeaving(cards, card, "library")
  if (destroyed) return destroyed
  const without = cards.filter((c) => c.instanceId !== card.instanceId)
  const asLib: PlayingCardInstance = {
    instanceId: card.instanceId,
    cardId: card.cardId,
    name: card.name,
    artPath: card.artPath,
    artVersion: card.artVersion,
    cost: card.cost ?? [],
    zone: "library",
    expended: false,
    selected: false,
    isResourceToken: card.isResourceToken,
    ...countersOnEnter(card, "library"),
  }
  const firstLib = without.findIndex((c) => c.zone === "library")
  if (firstLib < 0) return [...without, asLib]
  return [
    ...without.slice(0, firstLib),
    asLib,
    ...without.slice(firstLib),
  ]
}

/**
 * Place a card on the bottom of the library (last among library entries).
 * Used by Accumulate Resources after revealing from hand.
 */
export function putCardOnLibraryBottom(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroyResourceCardIfLeaving(cards, card, "library")
  if (destroyed) return destroyed
  const without = cards.filter((c) => c.instanceId !== card.instanceId)
  const asLib: PlayingCardInstance = {
    instanceId: card.instanceId,
    cardId: card.cardId,
    name: card.name,
    artPath: card.artPath,
    artVersion: card.artVersion,
    cost: card.cost ?? [],
    zone: "library",
    expended: false,
    selected: false,
    ...countersOnEnter(card, "library"),
  }
  const lastLib = (() => {
    let idx = -1
    without.forEach((c, i) => {
      if (c.zone === "library") idx = i
    })
    return idx
  })()
  if (lastLib < 0) return [...without, asLib]
  return [
    ...without.slice(0, lastLib + 1),
    asLib,
    ...without.slice(lastLib + 1),
  ]
}

/** Put several cards on the library bottom (resource tokens are destroyed). */
export function putCardsOnLibraryBottom(
  cards: PlayingCardInstance[],
  instanceIds: string[]
): PlayingCardInstance[] {
  let next = cards
  for (const id of instanceIds) {
    const card = next.find((c) => c.instanceId === id)
    if (!card || card.zone === "library") continue
    next = putCardOnLibraryBottom(next, card)
  }
  return next
}

/** Move a card into the trashyard (face-up discard; newest on top). */
export function moveToTrashyard(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  const destroyed = destroyResourceTokenIfLeaving(
    cards,
    instanceId,
    "trashyard"
  )
  if (destroyed) return destroyed
  const card = cards.find((c) => c.instanceId === instanceId)
  if (!card || card.zone === "trashyard") return cards
  const without = cards.filter((c) => c.instanceId !== instanceId)
  const asTrash: PlayingCardInstance = {
    instanceId: card.instanceId,
    cardId: card.cardId,
    name: card.name,
    artPath: card.artPath,
    artVersion: card.artVersion,
    cost: card.cost ?? [],
    zone: "trashyard",
    expended: false,
    selected: false,
    isResourceToken: card.isResourceToken,
    ...countersOnEnter(card, "trashyard"),
  }
  // Append so the newest discard is last in array = top of the pile UI.
  return [...without, asTrash]
}

/** Seat a limbo card into the trashyard after a draw animation. */
export function putCardInTrashyard(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroyResourceCardIfLeaving(cards, card, "trashyard")
  if (destroyed) return destroyed
  return moveToTrashyard(
    [
      ...cards,
      {
        instanceId: card.instanceId,
        cardId: card.cardId,
        name: card.name,
        artPath: card.artPath,
        artVersion: card.artVersion,
        cost: card.cost ?? [],
        zone: "hand",
        expended: false,
        selected: false,
        isResourceToken: card.isResourceToken,
        // Seated from an animation overlay, so it is entering the pile fresh.
        ...NO_COUNTERS,
      },
    ],
    card.instanceId
  )
}

/** Move a card into the dismantled zone (face-up; newest on top). */
export function moveToDismantled(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  const destroyed = destroyResourceTokenIfLeaving(
    cards,
    instanceId,
    "dismantled"
  )
  if (destroyed) return destroyed
  const card = cards.find((c) => c.instanceId === instanceId)
  if (!card || card.zone === "dismantled") return cards
  const without = cards.filter((c) => c.instanceId !== instanceId)
  const asDismantled: PlayingCardInstance = {
    instanceId: card.instanceId,
    cardId: card.cardId,
    name: card.name,
    artPath: card.artPath,
    artVersion: card.artVersion,
    cost: card.cost ?? [],
    zone: "dismantled",
    expended: false,
    selected: false,
    isResourceToken: card.isResourceToken,
    ...countersOnEnter(card, "dismantled"),
  }
  return [...without, asDismantled]
}

/** Seat a limbo card into dismantled after a draw animation. */
export function putCardInDismantled(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroyResourceCardIfLeaving(cards, card, "dismantled")
  if (destroyed) return destroyed
  return moveToDismantled(
    [
      ...cards,
      {
        instanceId: card.instanceId,
        cardId: card.cardId,
        name: card.name,
        artPath: card.artPath,
        artVersion: card.artVersion,
        cost: card.cost ?? [],
        zone: "hand",
        expended: false,
        selected: false,
        isResourceToken: card.isResourceToken,
        // Seated from an animation overlay, so it is entering the pile fresh.
        ...NO_COUNTERS,
      },
    ],
    card.instanceId
  )
}

/** Seat a limbo card onto the battlefield after a draw animation. */
export function putCardOnBattlefield(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  x: number,
  y: number
): PlayingCardInstance[] {
  const without = cards.filter((c) => c.instanceId !== card.instanceId)
  return [
    ...without,
    {
      ...card,
      ...countersOnEnter(card, "battlefield"),
      zone: "battlefield",
      x,
      y,
      expended: expendedOnEnter(card, PLAY_ZONE.battlefield),
      selected: false,
    },
  ]
}

/** Move a card into the stockpile free-float zone. */
export function moveToStockpile(
  cards: PlayingCardInstance[],
  instanceId: string,
  x: number,
  y: number
): PlayingCardInstance[] {
  return cards.map((c) =>
    c.instanceId === instanceId
      ? {
          ...c,
          ...countersOnEnter(c, "stockpile"),
          zone: "stockpile" as const,
          x,
          y,
          expended: expendedOnEnter(c, PLAY_ZONE.stockpile),
          selected: false,
        }
      : c
  )
}

/** Seat a limbo card onto the stockpile after a draw animation. */
export function putCardOnStockpile(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  x: number,
  y: number
): PlayingCardInstance[] {
  const without = cards.filter((c) => c.instanceId !== card.instanceId)
  return [
    ...without,
    {
      ...card,
      ...countersOnEnter(card, "stockpile"),
      zone: "stockpile",
      x,
      y,
      expended: expendedOnEnter(card, PLAY_ZONE.stockpile),
      selected: false,
    },
  ]
}

/**
 * Seat a card in the pilot slot (capacity 1).
 * Any card already in pilot is bumped back to hand.
 * Resource tokens targeting pilot (or bumped into hand) are destroyed.
 */
export function moveToPilot(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  const destroyed = destroyResourceTokenIfLeaving(cards, instanceId, "pilot")
  if (destroyed) return destroyed

  const next: PlayingCardInstance[] = []
  for (const c of cards) {
    if (c.instanceId === instanceId) {
      next.push({
        ...c,
        ...countersOnEnter(c, "pilot"),
        zone: "pilot" as const,
        x: undefined,
        y: undefined,
        expended: false,
        selected: false,
      })
      continue
    }
    if (c.zone === "pilot") {
      // Bump to hand — resource tokens leave play instead.
      if (isResourceTokenInstance(c)) continue
      next.push({
        ...c,
        ...countersOnEnter(c, "hand"),
        zone: "hand" as const,
        x: undefined,
        y: undefined,
        expended: false,
        selected: false,
      })
      continue
    }
    next.push(c)
  }
  return next
}

/**
 * Seat a limbo card into the pilot slot after a draw animation (capacity 1).
 * Bumps any existing pilot card to hand.
 */
export function putCardOnPilot(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroyResourceCardIfLeaving(cards, card, "pilot")
  if (destroyed) return destroyed
  const without = cards.filter((c) => c.instanceId !== card.instanceId)
  const bumped = without.flatMap((c) => {
    if (c.zone !== "pilot") return [c]
    if (isResourceTokenInstance(c)) return []
    return [
      {
        ...c,
        ...countersOnEnter(c, "hand"),
        zone: "hand" as const,
        x: undefined,
        y: undefined,
        expended: false,
        selected: false,
      },
    ]
  })
  return [
    ...bumped,
    {
      instanceId: card.instanceId,
      cardId: card.cardId,
      name: card.name,
      artPath: card.artPath,
      artVersion: card.artVersion,
      cost: card.cost ?? [],
      zone: "pilot",
      expended: false,
      selected: false,
      isResourceToken: card.isResourceToken,
      ...countersOnEnter(card, "pilot"),
    },
  ]
}

/** Piles that expose a bulk "Move all" context action. */
export type MoveAllSourceZone =
  | typeof PLAY_ZONE.library
  | typeof PLAY_ZONE.trashyard
  | typeof PLAY_ZONE.dismantled

/** Destinations offered by "Move all" (never includes dismantled). */
export type MoveAllDestinationZone =
  | typeof PLAY_ZONE.library
  | typeof PLAY_ZONE.stockpile
  | typeof PLAY_ZONE.trashyard

const STOCKPILE_MOVE_ALL_STEP_X = 28
const STOCKPILE_MOVE_ALL_STEP_Y = 16
const STOCKPILE_MOVE_ALL_COLS = 8

/**
 * Move every card in `from` into `to`. No-op when the pile is empty or when
 * source and destination are the same (e.g. trash → trash).
 *
 * Library: cards are placed on top in bottom→top pile order so the former top
 * of the source pile stays on top of the deck.
 */
export function moveAllFromZone(
  cards: PlayingCardInstance[],
  from: MoveAllSourceZone,
  to: MoveAllDestinationZone
): PlayingCardInstance[] {
  if (from === to) return cards
  const moving = cards.filter((c) => c.zone === from)
  if (moving.length === 0) return cards

  let next = cards
  if (to === PLAY_ZONE.library) {
    for (const card of moving) {
      next = putCardOnLibraryTop(next, card)
    }
    return next
  }

  if (to === PLAY_ZONE.trashyard) {
    for (const card of moving) {
      next = moveToTrashyard(next, card.instanceId)
    }
    return next
  }

  let seq = next.filter((c) => c.zone === PLAY_ZONE.stockpile).length
  for (const card of moving) {
    const x = 20 + (seq % STOCKPILE_MOVE_ALL_COLS) * STOCKPILE_MOVE_ALL_STEP_X
    const y =
      24 + Math.floor(seq / STOCKPILE_MOVE_ALL_COLS) * STOCKPILE_MOVE_ALL_STEP_Y
    next = moveToStockpile(next, card.instanceId, x, y)
    seq += 1
  }
  return next
}

