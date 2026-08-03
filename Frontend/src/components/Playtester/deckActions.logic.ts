/**
 * Library (deck) playtester actions: shuffle, degrade, peek, search filter.
 * Library order = session array order among zone === library (first = top).
 */

import { PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import {
  cardsInZone,
  shuffleInPlace,
  type PlayingCardInstance,
} from "@/components/Playtester/playCard.logic"
import {
  putCardInTrashyard,
  takeTopLibraryCard,
} from "@/components/Playtester/zoneMoves.logic"

/** Library cards in deck order (index 0 = top). */
export function libraryCardsInOrder(
  cards: PlayingCardInstance[]
): PlayingCardInstance[] {
  return cards.filter((c) => c.zone === PLAY_ZONE.library)
}

/** Top `n` library cards without removing them. */
export function peekTopLibrary(
  cards: PlayingCardInstance[],
  n: number
): PlayingCardInstance[] {
  const count = Math.max(0, Math.floor(n))
  return libraryCardsInOrder(cards).slice(0, count)
}

/**
 * DEGRADE X — put the top X cards of the library into the trashyard.
 * Processed top-first so the last milled card sits on top of the trash.
 */
export function degradeTopLibrary(
  cards: PlayingCardInstance[],
  n: number
): PlayingCardInstance[] {
  const available = cardsInZone(cards, PLAY_ZONE.library).length
  const count = Math.max(0, Math.min(Math.floor(n), available))
  let next = cards
  for (let i = 0; i < count; i++) {
    const taken = takeTopLibraryCard(next)
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
  n: number
): PlayingCardInstance[] {
  const lib = libraryCardsInOrder(cards)
  const count = Math.max(0, Math.min(Math.floor(n), lib.length))
  if (count === 0 || count === lib.length) return cards
  const nonLib = cards.filter((c) => c.zone !== PLAY_ZONE.library)
  return [...nonLib, ...lib.slice(count), ...lib.slice(0, count)]
}

/** Fisher–Yates shuffle of library cards only; other zones keep relative order. */
export function shuffleLibrary(
  cards: PlayingCardInstance[]
): PlayingCardInstance[] {
  const lib = libraryCardsInOrder(cards)
  const rest = cards.filter((c) => c.zone !== PLAY_ZONE.library)
  if (lib.length <= 1) return cards
  return [...rest, ...shuffleInPlace([...lib])]
}

/** Filter library cards by name (case-insensitive substring). Empty query = all. */
export function filterLibraryByName(
  cards: PlayingCardInstance[],
  query: string
): PlayingCardInstance[] {
  const lib = libraryCardsInOrder(cards)
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
 * Replace the top N library cards with `orderedInstanceIds` (same N cards, new order).
 * Index 0 of `orderedInstanceIds` becomes the new top of the deck.
 * No-op if the id set does not match the current top N.
 */
export function reorderTopLibrary(
  cards: PlayingCardInstance[],
  orderedInstanceIds: string[]
): PlayingCardInstance[] {
  if (orderedInstanceIds.length === 0) return cards

  const lib = libraryCardsInOrder(cards)
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
  const nonLib = cards.filter((c) => c.zone !== PLAY_ZONE.library)
  return [...nonLib, ...reorderedTop, ...restLib]
}
