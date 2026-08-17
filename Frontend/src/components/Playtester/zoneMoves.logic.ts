/** Zone transfer helpers (move / put / take) for the playtester session. */

import {
  destroySessionCardIfLeaving,
  destroySessionTokenIfLeaving,
  isSessionTokenInstance,
} from "./sessionResources.logic"
import { LOCAL_SEAT, PLAY_ZONE, type PlayZone, type PlayerSlot } from "./playtesterConstants"
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

/** How identity fields are built when seating into a zone. */
type SeatShape = "float" | "reconstruct" | "reconstructOmitTokenFlag"

type ZoneSeatSpec = {
  zone: PlayZone
  /** Session tokens are removed instead of seating here. */
  destroyOnEnter: boolean
  shape: SeatShape
  expended: "inPlay" | "ready"
  /** Free-float zones need x/y; others clear them. */
  float?: true
}

const FLOAT_BATTLEFIELD: ZoneSeatSpec = {
  zone: PLAY_ZONE.battlefield,
  destroyOnEnter: false,
  shape: "float",
  expended: "inPlay",
  float: true,
}

const FLOAT_STOCKPILE: ZoneSeatSpec = {
  zone: PLAY_ZONE.stockpile,
  destroyOnEnter: false,
  shape: "float",
  expended: "inPlay",
  float: true,
}

const SEAT_HAND: ZoneSeatSpec = {
  zone: PLAY_ZONE.hand,
  destroyOnEnter: true,
  shape: "reconstruct",
  expended: "ready",
}

const SEAT_LIBRARY: ZoneSeatSpec = {
  zone: PLAY_ZONE.library,
  destroyOnEnter: true,
  shape: "reconstruct",
  expended: "ready",
}

/** Library bottom historically omitted the token flag (tokens already destroyed). */
const SEAT_LIBRARY_BOTTOM: ZoneSeatSpec = {
  zone: PLAY_ZONE.library,
  destroyOnEnter: true,
  shape: "reconstructOmitTokenFlag",
  expended: "ready",
}

const SEAT_TRASH: ZoneSeatSpec = {
  zone: PLAY_ZONE.trashyard,
  destroyOnEnter: true,
  shape: "reconstruct",
  expended: "ready",
}

const SEAT_DISMANTLED: ZoneSeatSpec = {
  zone: PLAY_ZONE.dismantled,
  destroyOnEnter: true,
  shape: "reconstruct",
  expended: "ready",
}

function seatCard(
  card: PlayingCardInstance,
  spec: ZoneSeatSpec,
  xy?: { x: number; y: number }
): PlayingCardInstance {
  const counters = countersOnEnter(card, spec.zone)
  const expended =
    spec.expended === "inPlay"
      ? expendedOnEnter(card, spec.zone)
      : false

  if (spec.shape === "float") {
    return {
      ...card,
      ...counters,
      zone: spec.zone,
      x: xy?.x,
      y: xy?.y,
      expended,
      selected: false,
    }
  }

  const base: PlayingCardInstance = {
    instanceId: card.instanceId,
    cardId: card.cardId,
    owner: card.owner,
    name: card.name,
    artPath: card.artPath,
    artVersion: card.artVersion,
    cost: card.cost ?? [],
    zone: spec.zone,
    expended,
    selected: false,
    ...counters,
  }
  if (spec.shape === "reconstruct") {
    base.isToken = card.isToken
  }
  return base
}

function placeLibraryTop(
  without: PlayingCardInstance[],
  seated: PlayingCardInstance
): PlayingCardInstance[] {
  const firstLib = without.findIndex(
    (c) => c.zone === "library" && c.owner === seated.owner
  )
  if (firstLib < 0) return [...without, seated]
  return [
    ...without.slice(0, firstLib),
    seated,
    ...without.slice(firstLib),
  ]
}

function placeLibraryBottom(
  without: PlayingCardInstance[],
  seated: PlayingCardInstance
): PlayingCardInstance[] {
  let lastLib = -1
  without.forEach((c, i) => {
    if (c.zone === "library" && c.owner === seated.owner) lastLib = i
  })
  if (lastLib < 0) return [...without, seated]
  return [
    ...without.slice(0, lastLib + 1),
    seated,
    ...without.slice(lastLib + 1),
  ]
}

/** In-place map seating (card stays in the array; update fields). */
function moveCardToZone(
  cards: PlayingCardInstance[],
  instanceId: string,
  spec: ZoneSeatSpec,
  xy?: { x: number; y: number }
): PlayingCardInstance[] {
  if (spec.destroyOnEnter) {
    const destroyed = destroySessionTokenIfLeaving(
      cards,
      instanceId,
      spec.zone
    )
    if (destroyed) return destroyed
  }

  if (
    (spec.zone === PLAY_ZONE.trashyard ||
      spec.zone === PLAY_ZONE.dismantled) &&
    cards.find((c) => c.instanceId === instanceId)?.zone === spec.zone
  ) {
    return cards
  }

  if (spec.float) {
    return cards.map((c) =>
      c.instanceId === instanceId ? seatCard(c, spec, xy) : c
    )
  }

  // Reconstruct piles: pull out then append (newest = top).
  const card = cards.find((c) => c.instanceId === instanceId)
  if (!card) return cards
  const without = cards.filter((c) => c.instanceId !== instanceId)
  return [...without, seatCard(card, spec)]
}

/** Limbo / put seating (filter duplicate id, then append or library insert). */
function putCardInZone(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  spec: ZoneSeatSpec,
  xy?: { x: number; y: number },
  libraryPlacement?: "top" | "bottom"
): PlayingCardInstance[] {
  if (spec.destroyOnEnter) {
    const destroyed = destroySessionCardIfLeaving(cards, card, spec.zone)
    if (destroyed) return destroyed
  }

  const without = cards.filter((c) => c.instanceId !== card.instanceId)
  const seated = seatCard(card, spec, xy)

  if (libraryPlacement === "top") return placeLibraryTop(without, seated)
  if (libraryPlacement === "bottom") return placeLibraryBottom(without, seated)
  return [...without, seated]
}

export function moveToBattlefield(
  cards: PlayingCardInstance[],
  instanceId: string,
  x: number,
  y: number
): PlayingCardInstance[] {
  return moveCardToZone(cards, instanceId, FLOAT_BATTLEFIELD, { x, y })
}

/** Return a battlefield card to hand (clears free-float position). */
export function moveToHand(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  const destroyed = destroySessionTokenIfLeaving(cards, instanceId, "hand")
  if (destroyed) return destroyed
  // Hand uses map-in-place (preserves relative order among non-moved cards).
  return cards.map((c) =>
    c.instanceId === instanceId ? seatCard(c, SEAT_HAND) : c
  )
}

/**
 * Remove the top library card from the session (first match in array order).
 * Caller holds `drawn` during the flip animation, then puts it in hand.
 */
export function takeTopLibraryCard(
  cards: PlayingCardInstance[],
  owner: PlayerSlot = LOCAL_SEAT
): { cards: PlayingCardInstance[]; drawn: PlayingCardInstance } | null {
  const top = cards.find((c) => c.zone === "library" && c.owner === owner)
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
  return putCardInZone(cards, card, SEAT_HAND)
}

/** Remove a card from the session (held in an animation overlay). */
export function putCardOnLibraryTop(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  return putCardInZone(cards, card, SEAT_LIBRARY, undefined, "top")
}

/**
 * Place a card on the bottom of the library (last among library entries).
 * Used by Accumulate Resources after revealing from hand.
 */
export function putCardOnLibraryBottom(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  return putCardInZone(cards, card, SEAT_LIBRARY_BOTTOM, undefined, "bottom")
}

/** Put several cards on the library bottom (session tokens are destroyed). */
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
  return moveCardToZone(cards, instanceId, SEAT_TRASH)
}

/** Seat a limbo card into the trashyard after a draw animation. */
export function putCardInTrashyard(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroySessionCardIfLeaving(cards, card, "trashyard")
  if (destroyed) return destroyed
  return putCardInZone(
    cards,
    {
      ...card,
      zone: "hand",
      expended: false,
      selected: false,
      ...NO_COUNTERS,
    },
    SEAT_TRASH
  )
}

/** Move a card into the dismantled zone (face-up; newest on top). */
export function moveToDismantled(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  return moveCardToZone(cards, instanceId, SEAT_DISMANTLED)
}

/** Seat a limbo card into dismantled after a draw animation. */
export function putCardInDismantled(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance
): PlayingCardInstance[] {
  const destroyed = destroySessionCardIfLeaving(cards, card, "dismantled")
  if (destroyed) return destroyed
  return putCardInZone(
    cards,
    {
      ...card,
      zone: "hand",
      expended: false,
      selected: false,
      ...NO_COUNTERS,
    },
    SEAT_DISMANTLED
  )
}

/** Seat a limbo card onto the battlefield after a draw animation. */
export function putCardOnBattlefield(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  x: number,
  y: number
): PlayingCardInstance[] {
  return putCardInZone(cards, card, FLOAT_BATTLEFIELD, { x, y })
}

/** Move a card into the stockpile free-float zone. */
export function moveToStockpile(
  cards: PlayingCardInstance[],
  instanceId: string,
  x: number,
  y: number
): PlayingCardInstance[] {
  return moveCardToZone(cards, instanceId, FLOAT_STOCKPILE, { x, y })
}

/** Seat a limbo card onto the stockpile after a draw animation. */
export function putCardOnStockpile(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  x: number,
  y: number
): PlayingCardInstance[] {
  return putCardInZone(cards, card, FLOAT_STOCKPILE, { x, y })
}

/**
 * Seat a card in the pilot slot (capacity 1).
 * Any card already in pilot is bumped back to hand.
 * Session tokens targeting pilot (or bumped into hand) are destroyed.
 */
export function moveToPilot(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  const seated = cards.find((c) => c.instanceId === instanceId)
  if (!seated) return cards
  if (seated.zone === PLAY_ZONE.pilot) return cards

  const destroyed = destroySessionTokenIfLeaving(cards, instanceId, "pilot")
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
    if (c.zone === "pilot" && c.owner === seated.owner) {
      // Bump to hand — session tokens leave play instead.
      if (isSessionTokenInstance(c)) continue
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
  const destroyed = destroySessionCardIfLeaving(cards, card, "pilot")
  if (destroyed) return destroyed
  const without = cards.filter((c) => c.instanceId !== card.instanceId)
  const bumped = without.flatMap((c) => {
    if (c.zone !== "pilot" || c.owner !== card.owner) return [c]
    if (isSessionTokenInstance(c)) return []
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
    seatCard(card, {
      zone: PLAY_ZONE.pilot,
      destroyOnEnter: false,
      shape: "reconstruct",
      expended: "ready",
    }),
  ]
}

/** Piles that expose a bulk "Move all" context action. */
export type MoveAllSourceZone =
  | typeof PLAY_ZONE.library
  | typeof PLAY_ZONE.trashyard
  | typeof PLAY_ZONE.dismantled

/** Destinations offered by "Move all" (never includes stockpile). */
export type MoveAllDestinationZone =
  | typeof PLAY_ZONE.library
  | typeof PLAY_ZONE.dismantled
  | typeof PLAY_ZONE.trashyard

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
  to: MoveAllDestinationZone,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  if (from === to) return cards
  const moving = cards.filter((c) => c.zone === from && c.owner === owner)
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

  for (const card of moving) {
    next = moveToDismantled(next, card.instanceId)
  }
  return next
}
