/**
 * Library (deck) playtester actions: shuffle, degrade, peek, search filter.
 * Library order = session array order among zone === library (first = top).
 */

import { LOCAL_SEAT, PLAY_ZONE, type PlayerSlot } from "@/components/Playtester/constants"
import {
  cardsInZone,
  shuffleInPlace,
  type PlayingCardInstance,
} from "@/components/Playtester/session/playCard.logic"
import {
  putCardInTrashyard,
  takeTopLibraryCard,
} from "@/components/Playtester/drag/zoneMoves.logic"

/** Library cards in deck order (index 0 = top) for one seat. */
export function libraryCardsInOrder(
  cards: PlayingCardInstance[],
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  return cards.filter((c) => c.zone === PLAY_ZONE.library && c.owner === owner)
}

/** Top `n` library cards without removing them. */
export function peekTopLibrary(
  cards: PlayingCardInstance[],
  n: number,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  const count = Math.max(0, Math.floor(n))
  return libraryCardsInOrder(cards, owner).slice(0, count)
}

/**
 * DEGRADE X — put the top X cards of the library into the trashyard.
 * Processed top-first so the last milled card sits on top of the trash.
 */
export function degradeTopLibrary(
  cards: PlayingCardInstance[],
  n: number,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  const available = cardsInZone(cards, PLAY_ZONE.library, owner).length
  const count = Math.max(0, Math.min(Math.floor(n), available))
  let next = cards
  for (let i = 0; i < count; i++) {
    const taken = takeTopLibraryCard(next, owner)
    if (!taken) break
    next = putCardInTrashyard(taken.cards, taken.drawn)
  }
  return next
}

/**
 * Move the top X library cards to the bottom, keeping their relative order
 * (old top card ends up above the ones that followed it).
 */
export function putTopLibraryOnBottom(
  cards: PlayingCardInstance[],
  n: number,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  const lib = libraryCardsInOrder(cards, owner)
  const count = Math.max(0, Math.min(Math.floor(n), lib.length))
  if (count === 0 || count === lib.length) return cards
  const rest = cards.filter(
    (c) => !(c.zone === PLAY_ZONE.library && c.owner === owner)
  )
  return [...rest, ...lib.slice(count), ...lib.slice(0, count)]
}

/** Fisher–Yates shuffle of one seat's library; other cards keep relative order. */
export function shuffleLibrary(
  cards: PlayingCardInstance[],
  owner: PlayerSlot = LOCAL_SEAT,
  next: () => number = Math.random
): PlayingCardInstance[] {
  const lib = libraryCardsInOrder(cards, owner)
  const rest = cards.filter(
    (c) => !(c.zone === PLAY_ZONE.library && c.owner === owner)
  )
  if (lib.length <= 1) return cards
  return [...rest, ...shuffleInPlace([...lib], next)]
}

/** Filter library cards by name (case-insensitive substring). Empty query = all. */
export function filterLibraryByName(
  cards: PlayingCardInstance[],
  query: string,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  const lib = libraryCardsInOrder(cards, owner)
  const q = query.trim().toLowerCase()
  if (!q) return lib
  return lib.filter((c) => c.name.toLowerCase().includes(q))
}

/** One printing plus every copy of it, in the order they appear in the deck. */
export type CardPrintingGroup = {
  cardId: number
  /** Copy shown on the tile / dragged out first (topmost of the group). */
  display: PlayingCardInstance
  instances: PlayingCardInstance[]
}

/**
 * Collapse copies of the same printing into one group each, keeping the order
 * of first appearance. Mirrors the trashyard fan so search shows ×N instead of
 * repeating identical tiles.
 */
export function groupCardsByPrinting(
  cards: PlayingCardInstance[]
): CardPrintingGroup[] {
  const byId = new Map<number, PlayingCardInstance[]>()
  const order: number[] = []
  for (const card of cards) {
    const list = byId.get(card.cardId)
    if (list) {
      list.push(card)
      continue
    }
    byId.set(card.cardId, [card])
    order.push(card.cardId)
  }
  return order.map((cardId) => {
    const instances = byId.get(cardId)!
    return { cardId, display: instances[0]!, instances }
  })
}

/** Clamp a user-entered count against library size (0 if empty / invalid). */
export function clampDeckCount(raw: number, librarySize: number): number {
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(Math.floor(raw), Math.max(0, librarySize)))
}

/**
 * Build the library top order after a Look-at-top session.
 * Discarded ids are placed first so `degradeTopLibrary(n)` / the degrade
 * animation can mill them off the top; remaining ids follow in keeper order.
 * Returns null if the combined set does not match `originalPeeked`.
 */
export function lookAtTopCommitOrder(
  remainingOrderedIds: string[],
  discardIds: string[],
  originalPeeked: PlayingCardInstance[]
): string[] | null {
  const combined = [...discardIds, ...remainingOrderedIds]
  if (combined.length !== originalPeeked.length) return null
  if (new Set(combined).size !== combined.length) return null
  const orig = originalPeeked.map((c) => c.instanceId).sort()
  const got = [...combined].sort()
  if (orig.some((id, i) => id !== got[i])) return null
  return combined
}

/**
 * Replace the top N library cards with `orderedInstanceIds` (same N cards, new order).
 * Index 0 of `orderedInstanceIds` becomes the new top of the deck.
 * No-op if the id set does not match the current top N.
 */
export function reorderTopLibrary(
  cards: PlayingCardInstance[],
  orderedInstanceIds: string[],
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  if (orderedInstanceIds.length === 0) return cards

  const lib = libraryCardsInOrder(cards, owner)
  const n = orderedInstanceIds.length
  if (n > lib.length) return cards

  const top = lib.slice(0, n)
  const topIds = top.map((c) => c.instanceId).sort()
  const orderedSorted = [...orderedInstanceIds].sort()
  if (
    topIds.length !== orderedSorted.length ||
    topIds.some((id, i) => id !== orderedSorted[i])
  ) {
    return cards
  }

  const byId = new Map(top.map((c) => [c.instanceId, c]))
  const reorderedTop = orderedInstanceIds.map((id) => byId.get(id)!)
  const restLib = lib.slice(n)
  const rest = cards.filter(
    (c) => !(c.zone === PLAY_ZONE.library && c.owner === owner)
  )
  return [...rest, ...reorderedTop, ...restLib]
}
