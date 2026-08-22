/**
 * Opening playtester setup from a loaded deck:
 * pilot → pilot zone, augments → battlefield (row above the default hand,
 * applied per viewer), main deck shuffle + draw, starting resource tokens
 * → stockpile (colour fans beside the hand, applied per viewer).
 */

import {
  augmentCards,
  categoryCountsInDeck,
  pilotCard,
} from "@/components/decks/deck.logic"
import {
  RESOURCE_COLORS,
  spawnResourceTokenInstance,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources.logic"
import { stampStockpileWorldHomes } from "@/components/Playtester/augmentRow.logic"
import {
  expandDeckToPlayInstances,
  LOCAL_SEAT,
  putCardOnLibraryBottom,
  shuffleInPlace,
  type PlayerSlot,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckCardEntry, DeckDetail } from "@/lib/api/decks"

/** Map pilot capacity columns → coloured resource pips (not life). */
export function startingResourceColorsFromPilot(
  pilot: DeckCardEntry | null | undefined
): ResourceColor[] {
  if (!pilot) return []
  const out: ResourceColor[] = []
  const push = (color: ResourceColor, count: number | undefined) => {
    const n = Math.max(0, Math.floor(count ?? 0))
    for (let i = 0; i < n; i++) out.push(color)
  }
  push("RAM", pilot.ram_capacity)
  push("POW", pilot.power_capacity)
  push("MET", pilot.metal_capacity)
  push("LIF", pilot.spirit_capacity)
  push("TIM", pilot.time_capacity)
  push("STL", pilot.steel_capacity)
  return out
}

/** Starting life total printed on the pilot (`lif_capacity`). */
export function startingLifeFromPilot(
  pilot: DeckCardEntry | null | undefined
): number {
  return Math.max(0, Math.floor(pilot?.lif_capacity ?? 0))
}

/**
 * Spawn starting resource tokens (no positions yet — caller stamps world homes).
 */
export function spawnGroupedStockpileResources(
  colors: ResourceColor[],
  resourceByColor: Map<ResourceColor, CardLibraryItem>,
  seqStart = 0,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  const counts = new Map<ResourceColor, number>()
  for (const color of colors) {
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }

  const out: PlayingCardInstance[] = []
  let seq = seqStart

  for (const color of RESOURCE_COLORS) {
    const count = counts.get(color) ?? 0
    if (count <= 0) continue
    const template = resourceByColor.get(color)
    if (!template) continue

    for (let i = 0; i < count; i++) {
      out.push(
        spawnResourceTokenInstance(template, undefined, undefined, seq, owner)
      )
      seq += 1
    }
  }

  return out
}

/** Playable library rows = in-deck sections (not Pilot / Augments / list-only). */
export function libraryDeckEntries(deck: DeckDetail): DeckCardEntry[] {
  const inDeckIds = new Set(
    deck.categories.filter(categoryCountsInDeck).map((c) => c.id)
  )
  return deck.cards.filter((card) => inDeckIds.has(card.category_id))
}

/**
 * Build the initial session board for one player.
 * `resourceByColor` should already be loaded; missing colours are skipped.
 */
export function setupOpeningSession(
  deck: DeckDetail,
  resourceByColor: Map<ResourceColor, CardLibraryItem>,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance[] {
  const pilotEntry = pilotCard(deck.cards, deck.categories)
  const augmentEntries = augmentCards(deck.cards, deck.categories, "name")
  const mainEntries = libraryDeckEntries(deck)

  const session: PlayingCardInstance[] = []

  if (pilotEntry) {
    const [pilotInst] = expandDeckToPlayInstances(
      [{ ...pilotEntry, quantity: 1 }],
      "pilot",
      owner
    )
    if (pilotInst) {
      session.push({
        ...pilotInst,
        zone: "pilot",
        instanceId: `${owner}-pilot-${pilotInst.cardId}`,
        expended: false,
        selected: false,
      })
    }
  }

  for (let i = 0; i < augmentEntries.length; i++) {
    const entry = augmentEntries[i]!
    const [inst] = expandDeckToPlayInstances(
      [{ ...entry, quantity: 1 }],
      "battlefield",
      owner
    )
    if (!inst) continue
    // No x/y: each client pins unmoved augments above the default hand.
    session.push({
      ...inst,
      zone: "battlefield",
      isAugment: true,
      instanceId: `${owner}-augment-${inst.cardId}-${i}`,
      expended: false,
      selected: false,
    })
  }

  const handSize = Math.max(0, Math.floor(pilotEntry?.hand_size ?? 0))
  const pool = shuffleInPlace(
    expandDeckToPlayInstances(mainEntries, "library", owner)
  )

  const hand = pool.slice(0, handSize).map((card, index) => ({
    ...card,
    zone: "hand" as const,
    instanceId: `${owner}-hand-${card.cardId}-${index}`,
    expended: false,
    selected: false,
    x: undefined,
    y: undefined,
  }))

  const library = pool.slice(handSize).map((card, index) => ({
    ...card,
    zone: "library" as const,
    instanceId: `${owner}-lib-${card.cardId}-${index}`,
    expended: false,
    selected: false,
    x: undefined,
    y: undefined,
  }))

  session.push(...hand, ...library)

  // World homes (p1 bottom / p2 top) so fog sync + guest view agree on side.
  session.push(
    ...stampStockpileWorldHomes(
      spawnGroupedStockpileResources(
        startingResourceColorsFromPilot(pilotEntry),
        resourceByColor,
        0,
        owner
      ),
      owner
    )
  )

  return session
}

/**
 * One-time mulligan: selected hand cards go to library bottom (hand order).
 * Caller draws `drawCount` replacements (ideally with the draw animation).
 */
export function applyMulliganToBottom(
  cards: PlayingCardInstance[],
  selectedInstanceIds: string[],
  owner: PlayerSlot = LOCAL_SEAT
): { cards: PlayingCardInstance[]; drawCount: number } {
  if (selectedInstanceIds.length === 0) {
    return { cards, drawCount: 0 }
  }

  const selected = new Set(selectedInstanceIds)
  const handOrder = cards.filter(
    (c) => c.zone === "hand" && c.owner === owner
  )
  const toBottom = handOrder.filter((c) => selected.has(c.instanceId))
  if (toBottom.length === 0) {
    return { cards, drawCount: 0 }
  }

  let next = cards
  for (const card of toBottom) {
    next = putCardOnLibraryBottom(next, card)
  }

  return { cards: next, drawCount: toBottom.length }
}

