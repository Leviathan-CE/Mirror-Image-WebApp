/** Playtester session types (zones + one physical card copy). */

export type PlayZone =
  | "hand"
  | "battlefield"
  | "library"
  | "stockpile"
  | "pilot"
  | "trashyard"
  | "dismantled"

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
  /**
   * Created Resource Token (not a deck card). Destroyed if it would enter
   * library / hand / trashyard / dismantled / pilot.
   */
  isResourceToken?: boolean
  /** Green time counters (stockpile / lock timing). */
  timeCounters?: number
  /** Red damage counters marked on the card. */
  damageCounters?: number
  /** Extra TLV (threat level) counters. */
  tlvCounters?: number
}

/** Expand one deck list row into a single play instance (first copy). */
export function deckEntryToPlayInstance(
  entry: {
    card_id: number
    card_name: string
    card_art_path: string | null
    card_art_version?: number | null
    cost?: string[] | null
  },
  zone: PlayZone = "hand"
): PlayingCardInstance {
  return {
    instanceId: `preview-${entry.card_id}`,
    cardId: entry.card_id,
    name: entry.card_name,
    artPath: entry.card_art_path,
    artVersion: entry.card_art_version ?? null,
    cost: Array.isArray(entry.cost) ? entry.cost.map(String) : [],
    zone,
    expended: false,
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
  }>,
  zone: PlayZone = "library"
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

/**
 * Start-of-turn cleanup for free-float zones:
 * ready (un-expend) every battlefield + stockpile card, and remove 1 time
 * counter from each that still has at least one.
 */
export function readyBattlefieldAndStockpile(
  cards: PlayingCardInstance[]
): PlayingCardInstance[] {
  return cards.map((c) => {
    if (c.zone !== "battlefield" && c.zone !== "stockpile") return c
    const time = c.timeCounters ?? 0
    return {
      ...c,
      expended: false,
      selected: false,
      timeCounters: time > 0 ? time - 1 : 0,
    }
  })
}

export function cardsInZone(
  cards: PlayingCardInstance[],
  zone: PlayZone
): PlayingCardInstance[] {
  return cards.filter((c) => c.zone === zone)
}

/** Play a hand card onto the battlefield at local surface coords. */
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
          zone: "battlefield" as const,
          x,
          y,
          expended: false,
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
    },
  ]
}

/** Remove a card from the session (held in an animation overlay). */
export function removeCard(
  cards: PlayingCardInstance[],
  instanceId: string
): PlayingCardInstance[] {
  return cards.filter((c) => c.instanceId !== instanceId)
}

/** Resource tokens cease to exist in these zones (do not relocate there). */
const RESOURCE_DESTROY_ZONES: ReadonlySet<PlayZone> = new Set([
  "library",
  "hand",
  "trashyard",
  "dismantled",
  "pilot",
])

export function isResourceTokenInstance(
  card: PlayingCardInstance | undefined | null
): boolean {
  return Boolean(card?.isResourceToken)
}

export type CardCounterKind = "time" | "damage" | "tlv"

/** Add (or subtract) counters on a session card. Counts never go below 0. */
export function adjustCardCounter(
  cards: PlayingCardInstance[],
  instanceId: string,
  kind: CardCounterKind,
  delta: number
): PlayingCardInstance[] {
  return cards.map((c) => {
    if (c.instanceId !== instanceId) return c
    const key =
      kind === "time"
        ? "timeCounters"
        : kind === "damage"
          ? "damageCounters"
          : "tlvCounters"
    const current = c[key] ?? 0
    const next = Math.max(0, current + delta)
    return { ...c, [key]: next }
  })
}

/**
 * If `instanceId` is a resource token and `targetZone` destroys tokens,
 * remove it and return the new list. Otherwise return null (caller moves normally).
 */
export function destroyResourceTokenIfLeaving(
  cards: PlayingCardInstance[],
  instanceId: string,
  targetZone: PlayZone
): PlayingCardInstance[] | null {
  if (!RESOURCE_DESTROY_ZONES.has(targetZone)) return null
  const card = cards.find((c) => c.instanceId === instanceId)
  if (!isResourceTokenInstance(card)) return null
  return removeCard(cards, instanceId)
}

/**
 * If `card` is a resource token headed to a destroy zone, drop it from the
 * session instead of seating it. Otherwise return null.
 */
export function destroyResourceCardIfLeaving(
  cards: PlayingCardInstance[],
  card: PlayingCardInstance,
  targetZone: PlayZone
): PlayingCardInstance[] | null {
  if (!RESOURCE_DESTROY_ZONES.has(targetZone)) return null
  if (!isResourceTokenInstance(card)) return null
  return removeCard(cards, card.instanceId)
}

/**
 * Place a card on top of the library (becomes the next card drawn).
 * Top = first `library` entry in array order (see takeTopLibraryCard).
 */
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
      zone: "battlefield",
      x,
      y,
      expended: false,
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
          zone: "stockpile" as const,
          x,
          y,
          expended: false,
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
      zone: "stockpile",
      x,
      y,
      expended: false,
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
    },
  ]
}

const COPY_OFFSET_X = 28
const COPY_OFFSET_Y = 28

/**
 * Spawn a second physical copy of a free-float card (battlefield / stockpile).
 * New `instanceId` so React/drag treat it as a separate object; offset so it
 * is visible beside the original. Starts ready with no counters.
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
    isResourceToken: card.isResourceToken,
  }
  // Append so the copy paints above the original (same as moveCardtoFront).
  return [...cards, copy]
}