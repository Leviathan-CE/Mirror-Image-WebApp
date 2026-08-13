/** Playtester card instance + card-local session ops (no zone transfers). */

import {
  PLAY_ZONE,
  SELECTABLE_ACTION_ZONES,
  type PlayZone,
  type SelectableActionZone,
} from "./playtesterConstants"

export type { PlayZone, SelectableActionZone }
export { PLAY_ZONE, SELECTABLE_ACTION_ZONES }

export type PlayingCardInstance = {
  /** Unique even when the deck has multiple copies of the same card. */
  instanceId: string
  cardId: number
  name: string
  artPath: string | null
  artVersion?: number | null
  /** Invoke-cost icon list (LIF, MET, GEN2, …). */
  cost: string[]
  zone: PlayZone
  x?: number
  y?: number
  /** Mirror Image “tapped” / used this turn. */
  expended: boolean
  selected?: boolean
  /** True when the card shows its back instead of art. */
  faceDown?: boolean
  /**
   * Session token flag (Resource Token spawns + Create Copy). Destroyed if it
   * would enter library / hand / trashyard / dismantled / pilot. Battlefield
   * and stockpile are valid homes.
   */
  isToken?: boolean
  /** Green time counters (stockpile / lock timing). */
  timeCounters?: number
  /** Red damage counters marked on the card. */
  damageCounters?: number
  /** Extra TLV (threat level) counters. */
  tlvCounters?: number
  /**
   * −1 TLV counters (separate from +TLV). Adding one cancels one of the other.
   */
  tlvMinusCounters?: number
  /** Grey catch-all counters for effects with no dedicated counter. */
  genericCounters?: number
  /** Orange depletion counters. */
  depletionCounters?: number
  /** Preview / unpublished content stripped for this viewer. */
  isClassified?: boolean
  /** classified = preview lock; top_secret = not published. */
  classification?: "classified" | "top_secret" | null
}

/** Expand one deck list row into a single play instance (first copy). */
export function deckEntryToPlayInstance(
  entry: {
    card_id: number
    card_name: string
    card_art_path: string | null
    card_art_version?: number | null
    cost?: string[] | null
    is_classified?: boolean
    classification?: "classified" | "top_secret" | null
  },
  zone: PlayZone = PLAY_ZONE.hand
): PlayingCardInstance {
  const classification =
    entry.classification === "classified" || entry.classification === "top_secret"
      ? entry.classification
      : entry.is_classified
        ? "classified"
        : null
  const classified = classification != null
  return {
    instanceId: `preview-${entry.card_id}`,
    cardId: entry.card_id,
    name: entry.card_name,
    artPath: classified ? null : entry.card_art_path,
    artVersion: classified ? null : (entry.card_art_version ?? null),
    cost: classified
      ? []
      : Array.isArray(entry.cost)
        ? entry.cost.map(String)
        : [],
    zone,
    expended: false,
    isClassified: classified,
    classification,
  }
}

/**
 * Expand deck list rows into physical copies using each entry's `quantity`.
 * Example: one row with quantity 3 → three PlayingCardInstance values.
 */
export function expandDeckToPlayInstances(
  entries: Array<{
    card_id: number
    card_name: string
    card_art_path: string | null
    card_art_version?: number | null
    cost?: string[] | null
    quantity: number
    is_classified?: boolean
    classification?: "classified" | "top_secret" | null
  }>,
  zone: PlayZone = PLAY_ZONE.library
): PlayingCardInstance[] {
  const out: PlayingCardInstance[] = []
  for (const entry of entries) {
    const qty = Math.max(0, Math.floor(entry.quantity ?? 0))
    for (let copy = 0; copy < qty; copy++) {
      out.push({
        ...deckEntryToPlayInstance(entry, zone),
        instanceId: `${zone}-${entry.card_id}-c${copy}-${out.length}`,
      })
    }
  }
  return out
}

/** In-place Fisher–Yates shuffle (returns the same array). */
export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
  return items
}

/**
 *  moves current selected card instance to the front of the 
 * list making it display ontop of everything else
 * @param cards 
 * @param instanceId 
 * @returns list of cards instances
 */
export function moveCardtoFront(
  cards: PlayingCardInstance[],
  instanceId: string 
): PlayingCardInstance[] {
  const i = cards.findIndex((c) => c.instanceId ===instanceId)
  if (i < 0) return cards
  const next = [...cards]
  const [card] = next.splice(i, 1)
  next.push(card)
  return next

}
/**
 * move curretn selest insantce of card to the back
 * of the this making it dsiplay below all other cards
 * @param cards 
 * @param instanceId  
 * @returns list of cards instances 
*/
export function moveCardtoBack(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {

  const i = cards.findIndex((c) => c.instanceId === instanceId)
  if (i < 0) return cards
  const next = [...cards]
  const [card] = next.splice(i,1)
  next.unshift(card)
  return next
}

/**
 * Toggles state from expended to ready and visa versa
 * @param cards
 * @param instanceId
 * @returns list with a card expended var changed
 */
export function toggleExpended(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  return cards.map((c) =>
    c.instanceId === instanceId ? { ...c, expended: !c.expended } : c
  )
}

/** Flip a card between face-up art and the card back. */
export function toggleFaceDown(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  return cards.map((c) =>
    c.instanceId === instanceId ? { ...c, faceDown: !c.faceDown } : c
  )
}

/**
 * Set face orientation for many cards at once.
 * Multi-select should converge on one state (from the context-menu label),
 * not toggle each card independently (which would keep a mixed selection mixed).
 */
export function setCardsFaceDown(
  cards: PlayingCardInstance[],
  instanceIds: readonly string[],
  faceDown: boolean
): PlayingCardInstance[] {
  if (instanceIds.length === 0) return cards
  const ids = new Set(instanceIds)
  return cards.map((c) =>
    ids.has(c.instanceId) ? { ...c, faceDown } : c
  )
}

function isSelectableActionZone(
  zone: PlayZone
): zone is SelectableActionZone {
  return (SELECTABLE_ACTION_ZONES as readonly string[]).includes(zone)
}

/**
 * Context-menu / bulk actions: if the focus card is already selected in a
 * selectable zone, operate on the whole selection; otherwise just that card.
 */
export function selectableActionTargets(
  cards: PlayingCardInstance[],
  focus: PlayingCardInstance
): string[] {
  if (focus.selected && isSelectableActionZone(focus.zone)) {
    return cards
      .filter((c) => c.selected && isSelectableActionZone(c.zone))
      .map((c) => c.instanceId)
  }
  return [focus.instanceId]
}

/**
 * Start-of-turn cleanup for in-play expend zones:
 * ready (un-expend) every battlefield + stockpile + pilot card, and remove 1
 * time counter from each that still has at least one.
 *
 * The maintenance phase readies *before* removing counters, so a card still
 * holding a counter at that moment keeps its expended state and only readies
 * on the following turn, once the counter is gone.
 */
export function readyBattlefieldAndStockpile(
  cards: PlayingCardInstance[]
): PlayingCardInstance[] {
  return cards.map((c) => {
    if (
      c.zone !== PLAY_ZONE.battlefield &&
      c.zone !== PLAY_ZONE.stockpile &&
      c.zone !== PLAY_ZONE.pilot
    ) {
      return c
    }
    const time = c.timeCounters ?? 0
    const waiting = time > 0
    return {
      ...c,
      expended: waiting ? c.expended : false,
      selected: false,
      timeCounters: waiting ? time - 1 : 0,
    }
  })
}

/**
 * After a time-counter change: pull stockpile cards that just hit 0 off the
 * board so the caller can fly them to the battlefield. Cards that were already
 * at 0 are left alone.
 */
export function extractStockpileTimeCompletions(
  before: PlayingCardInstance[],
  after: PlayingCardInstance[]
): { cards: PlayingCardInstance[]; launching: PlayingCardInstance[] } {
  const beforeById = new Map(before.map((c) => [c.instanceId, c]))
  const launching: PlayingCardInstance[] = []
  const cards = after.filter((c) => {
    const prev = beforeById.get(c.instanceId)
    if (
      prev &&
      prev.zone === PLAY_ZONE.stockpile &&
      c.zone === PLAY_ZONE.stockpile &&
      (prev.timeCounters ?? 0) > 0 &&
      (c.timeCounters ?? 0) === 0
    ) {
      launching.push(c)
      return false
    }
    return true
  })
  return { cards, launching }
}

export function cardsInZone(
  cards: PlayingCardInstance[],
  zone: PlayZone
): PlayingCardInstance[] {
  return cards.filter((c) => c.zone === zone)
}

/** Remove a card from the session (held in an animation overlay). */
export function removeCard(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  return cards.filter((c) => c.instanceId !== instanceId)
}

export type CardCounterKind =
  | "time"
  | "damage"
  | "tlv"
  | "tlvMinus"
  | "generic"
  | "depletion"

/**
 * Counter kind → the field it lives in. Single source of truth: a new kind
 * cannot compile until it is listed here, and zone moves read this map to know
 * what to clear.
 */
export const CARD_COUNTER_FIELD = {
  time: "timeCounters",
  damage: "damageCounters",
  tlv: "tlvCounters",
  tlvMinus: "tlvMinusCounters",
  generic: "genericCounters",
  depletion: "depletionCounters",
} as const satisfies Record<CardCounterKind, keyof PlayingCardInstance>

export type CardCounterField = (typeof CARD_COUNTER_FIELD)[CardCounterKind]

/**
 * +TLV and −1 TLV cancel each other when *adding*.
 * Removing from a badge (negative delta) only reduces that kind.
 */
function applyTlvPairAdjust(
  card: PlayingCardInstance,
  kind: "tlv" | "tlvMinus",
  delta: number
): PlayingCardInstance {
  let tlv = card.tlvCounters ?? 0
  let tlvMinus = card.tlvMinusCounters ?? 0

  if (delta < 0) {
    if (kind === "tlv") tlv = Math.max(0, tlv + delta)
    else tlvMinus = Math.max(0, tlvMinus + delta)
  } else {
    let remaining = delta
    if (kind === "tlv") {
      const cancelled = Math.min(tlvMinus, remaining)
      tlvMinus -= cancelled
      remaining -= cancelled
      tlv += remaining
    } else {
      const cancelled = Math.min(tlv, remaining)
      tlv -= cancelled
      remaining -= cancelled
      tlvMinus += remaining
    }
  }

  return {
    ...card,
    tlvCounters: tlv > 0 ? tlv : undefined,
    tlvMinusCounters: tlvMinus > 0 ? tlvMinus : undefined,
  }
}

/** Add (or subtract) counters on a session card. Counts never go below 0. */
export function adjustCardCounter(
  cards: PlayingCardInstance[],
  instanceId: string,
  kind: CardCounterKind,
  delta: number
): PlayingCardInstance[] {
  return cards.map((c) => {
    if (c.instanceId !== instanceId) return c
    if (kind === "tlv" || kind === "tlvMinus") {
      return applyTlvPairAdjust(c, kind, delta)
    }
    const key = CARD_COUNTER_FIELD[kind]
    const current = c[key] ?? 0
    const next = Math.max(0, current + delta)
    return { ...c, [key]: next }
  })
}

const COPY_OFFSET_X = 28
const COPY_OFFSET_Y = 28

/**
 * Spawn a second physical copy of a free-float card (battlefield / stockpile).
 * New `instanceId` so React/drag treat it as a separate object; offset so it
 * is visible beside the original. Starts ready with no counters.
 *
 * Created copies are session tokens (`isResourceToken`): they stay on
 * battlefield / stockpile, but are destroyed if moved into hand, library,
 * trash, dismantled, or pilot — same leave-zone rules as resource tokens.
 */
export function duplicatePlayingCard(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  const card = cards.find((c) => c.instanceId === instanceId)
  if (!card) return cards
  if (card.zone !== "battlefield" && card.zone !== "stockpile") return cards

  const copy: PlayingCardInstance = {
    instanceId: `copy-${card.cardId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cardId: card.cardId,
    name: card.name,
    artPath: card.artPath,
    artVersion: card.artVersion,
    cost: card.cost ?? [],
    zone: card.zone,
    x: (card.x ?? 0) + COPY_OFFSET_X,
    y: (card.y ?? 0) + COPY_OFFSET_Y,
    expended: false,
    selected: false,
    isToken: true,
    faceDown: card.faceDown,
    isClassified: card.isClassified,
    classification: card.classification,
  }
  // Append so the copy paints above the original (same as moveCardtoFront).
  return [...cards, copy]
}

/** Duplicate each free-float id (multi-select “Create copy”). */
export function duplicatePlayingCards(
  cards: PlayingCardInstance[],
  instanceIds: string[]
): PlayingCardInstance[] {
  let next = cards
  for (const id of instanceIds) {
    next = duplicatePlayingCard(next, id)
  }
  return next
}