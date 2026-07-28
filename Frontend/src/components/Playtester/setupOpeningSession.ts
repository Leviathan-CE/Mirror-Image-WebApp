/**
 * Opening playtester setup from a loaded deck:
 * pilot → pilot zone, augments → battlefield, main deck shuffle + draw,
 * starting resource tokens → stockpile.
 */

import {
  augmentCards,
  isReservedCategory,
  pilotCard,
} from "@/components/decks/deckLogic"
import {
  RESOURCE_COLORS,
  spawnResourceTokenInstance,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources"
import {
  expandDeckToPlayInstances,
  putCardOnLibraryBottom,
  shuffleInPlace,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckCardEntry, DeckDetail } from "@/lib/api/decks"

/** Diagonal stagger inside one colour stack (matches physical stockpile piles). */
const STACK_STAGGER_X = 22
const STACK_STAGGER_Y = 22
/** Gap between the right edge of one colour stack and the next. */
const STACK_GROUP_GAP = 36
const RESOURCE_CARD_W = 112
const STOCKPILE_ORIGIN_X = 16
const STOCKPILE_ORIGIN_Y = 18

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
 * Lay out resource tokens in colour stacks: each colour is its own pile,
 * cards inside a pile stagger down-right; piles sit side-by-side.
 */
export function spawnGroupedStockpileResources(
  colors: ResourceColor[],
  resourceByColor: Map<ResourceColor, CardLibraryItem>,
  seqStart = 0
): PlayingCardInstance[] {
  const counts = new Map<ResourceColor, number>()
  for (const color of colors) {
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }

  const out: PlayingCardInstance[] = []
  let cursorX = STOCKPILE_ORIGIN_X
  let seq = seqStart

  for (const color of RESOURCE_COLORS) {
    const count = counts.get(color) ?? 0
    if (count <= 0) continue
    const template = resourceByColor.get(color)
    if (!template) continue

    for (let i = 0; i < count; i++) {
      out.push(
        spawnResourceTokenInstance(
          template,
          cursorX + i * STACK_STAGGER_X,
          STOCKPILE_ORIGIN_Y + i * STACK_STAGGER_Y,
          seq
        )
      )
      seq += 1
    }

    cursorX +=
      RESOURCE_CARD_W + Math.max(0, count - 1) * STACK_STAGGER_X + STACK_GROUP_GAP
  }

  return out
}

/** Playable library rows = every non-Pilot / non-Augment section. */
export function libraryDeckEntries(deck: DeckDetail): DeckCardEntry[] {
  const reservedIds = new Set(
    deck.categories.filter(isReservedCategory).map((c) => c.id)
  )
  return deck.cards.filter((card) => !reservedIds.has(card.category_id))
}

/**
 * Build the initial session board for one player.
 * `resourceByColor` should already be loaded; missing colours are skipped.
 */
export function setupOpeningSession(
  deck: DeckDetail,
  resourceByColor: Map<ResourceColor, CardLibraryItem>
): PlayingCardInstance[] {
  const pilotEntry = pilotCard(deck.cards, deck.categories)
  const augmentEntries = augmentCards(deck.cards, deck.categories, "name")
  const mainEntries = libraryDeckEntries(deck)

  const session: PlayingCardInstance[] = []

  if (pilotEntry) {
    const [pilotInst] = expandDeckToPlayInstances(
      [{ ...pilotEntry, quantity: 1 }],
      "pilot"
    )
    if (pilotInst) {
      session.push({
        ...pilotInst,
        zone: "pilot",
        instanceId: `pilot-${pilotInst.cardId}`,
        expended: false,
        selected: false,
      })
    }
  }

  for (let i = 0; i < augmentEntries.length; i++) {
    const entry = augmentEntries[i]!
    const [inst] = expandDeckToPlayInstances(
      [{ ...entry, quantity: 1 }],
      "battlefield"
    )
    if (!inst) continue
    session.push({
      ...inst,
      zone: "battlefield",
      instanceId: `augment-${inst.cardId}-${i}`,
      x: 24 + i * 132,
      y: 48,
      expended: false,
      selected: false,
    })
  }

  const handSize = Math.max(0, Math.floor(pilotEntry?.hand_size ?? 0))
  const pool = shuffleInPlace(expandDeckToPlayInstances(mainEntries, "library"))

  const hand = pool.slice(0, handSize).map((card, index) => ({
    ...card,
    zone: "hand" as const,
    instanceId: `hand-${card.cardId}-${index}`,
    expended: false,
    selected: false,
    x: undefined,
    y: undefined,
  }))

  const library = pool.slice(handSize).map((card, index) => ({
    ...card,
    zone: "library" as const,
    instanceId: `lib-${card.cardId}-${index}`,
    expended: false,
    selected: false,
    x: undefined,
    y: undefined,
  }))

  session.push(...hand, ...library)

  session.push(
    ...spawnGroupedStockpileResources(
      startingResourceColorsFromPilot(pilotEntry),
      resourceByColor
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
  selectedInstanceIds: string[]
): { cards: PlayingCardInstance[]; drawCount: number } {
  if (selectedInstanceIds.length === 0) {
    return { cards, drawCount: 0 }
  }

  const selected = new Set(selectedInstanceIds)
  const handOrder = cards.filter((c) => c.zone === "hand")
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

