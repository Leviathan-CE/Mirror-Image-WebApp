/**
 * Opening playtester setup from a loaded deck:
 * pilot → pilot zone, objectives → battlefield (row above the default hand,
 * applied per viewer), main deck shuffle + draw, starting resource tokens
 * → stockpile (colour fans beside the hand, applied per viewer).
 */

import {
  objectiveCards,
  categoryCountsInDeck,
  pilotCard,
} from "@/components/decks/deck.logic"
import { SHOW_DECK_OBJECTIVE_SLOT } from "@/components/decks/constants"
import {
  RESOURCE_COLORS,
  spawnResourceTokenInstance,
  type ResourceColor,
} from "@/components/Playtester/session/accumulateResources.logic"
import { stampStockpileWorldHomes } from "@/components/Playtester/board/augmentRow.logic"
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

function capacityOn(
  card: { [key: string]: unknown } | undefined,
  keys: string[]
): number {
  if (!card) return 0
  const lowered: { [key: string]: unknown } = {}
  for (const [rawKey, rawVal] of Object.entries(card)) {
    lowered[rawKey.trim().toLowerCase()] = rawVal
  }
  for (const key of keys) {
    const n = Math.floor(Number(lowered[key]))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

/** Map pilot capacity columns → coloured resource pips (not life). */
export function startingResourceColorsFromPilot(
  pilot: DeckCardEntry | null | undefined
): ResourceColor[] {
  if (!pilot) return []
  const out: ResourceColor[] = []
  const push = (color: ResourceColor, count: number) => {
    for (let i = 0; i < count; i++) out.push(color)
  }
  const card = pilot.card as { [key: string]: unknown }
  push("RAM", capacityOn(card, ["ram_capacity"]))
  push("POW", capacityOn(card, ["power_capacity"]))
  push("MET", capacityOn(card, ["metal_capacity"]))
  push("LIF", capacityOn(card, ["spirit_capacity"]))
  push("TIM", capacityOn(card, ["time_capacity", "tim_capacity"]))
  push("STL", capacityOn(card, ["steel_capacity"]))
  return out
}

/** Starting life total printed on the pilot (`lif_capacity`). */
export function startingLifeFromPilot(
  pilot: DeckCardEntry | null | undefined
): number {
  return Math.max(0, Math.floor(pilot?.card.lif_capacity ?? 0))
}

/**
 * Victory number printed on the pilot (VP needed to win).
 * Catalogue has no `vp_capacity` column yet — `lif_capacity` is the numeric
 * pilot stat we already load, so the denominator uses that until they split.
 */
export function victoryNumberFromPilot(
  pilot: DeckCardEntry | null | undefined
): number {
  return startingLifeFromPilot(pilot)
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

/** Playable library rows = in-deck sections (not Pilot / Objectives / list-only). */
export function libraryDeckEntries(deck: DeckDetail): DeckCardEntry[] {
  const inDeckIds = new Set(
    deck.categories.filter(categoryCountsInDeck).map((c) => c.id)
  )
  return deck.cards.filter((card) => inDeckIds.has(card.category_id))
}

/**
 * Build the initial session board for one player.
 * `resourceByColor` should already be loaded; missing colours are skipped.
 *
 * Objectives are omitted unless `includeObjectives` is true (defaults to
 * {@link SHOW_DECK_OBJECTIVE_SLOT} so deck builder + playtester stay in sync).
 */
export function setupOpeningSession(
  deck: DeckDetail,
  resourceByColor: Map<ResourceColor, CardLibraryItem>,
  owner: PlayerSlot = LOCAL_SEAT,
  options?: { includeObjectives?: boolean; includeAugments?: boolean }
): PlayingCardInstance[] {
  const includeObjectives =
    options?.includeObjectives ??
    options?.includeAugments ??
    SHOW_DECK_OBJECTIVE_SLOT
  const pilotEntry = pilotCard(deck.cards, deck.categories)
  const objectiveEntries = includeObjectives
    ? objectiveCards(deck.cards, deck.categories, "name")
    : []
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

  for (let i = 0; i < objectiveEntries.length; i++) {
    const entry = objectiveEntries[i]!
    const [inst] = expandDeckToPlayInstances(
      [{ ...entry, quantity: 1 }],
      "battlefield",
      owner
    )
    if (!inst) continue
    // No x/y: each client pins unmoved objectives above the default hand.
    session.push({
      ...inst,
      zone: "battlefield",
      isObjective: true,
      isAugment: true,
      instanceId: `${owner}-objective-${inst.cardId}-${i}`,
      expended: false,
      selected: false,
    })
  }

  const handSize = Math.max(0, Math.floor(pilotEntry?.card.hand_size ?? 0))
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
 * Colours both pilots will request at opening. Host uses own + opponent;
 * guest only has their own deck JSON.
 */
export function neededResourceColorsFromDecks(
  decks: Array<DeckDetail | null | undefined>
): ResourceColor[] {
  const seen = new Set<ResourceColor>()
  const needed: ResourceColor[] = []
  for (const deck of decks) {
    if (!deck) continue
    const colors = startingResourceColorsFromPilot(
      pilotCard(deck.cards, deck.categories)
    )
    for (const color of colors) {
      if (seen.has(color)) continue
      seen.add(color)
      needed.push(color)
    }
  }
  return needed
}

export function openingTimCoverage(args: {
  requestedColors: readonly ResourceColor[]
  resourceByColor: Map<ResourceColor, unknown>
  stockpile: Array<{ cost?: string[] | null }>
}): {
  pilotAsksTim: boolean
  mapHasTim: boolean
  stockpileTimCount: number
} {
  let stockpileTimCount = 0
  for (const card of args.stockpile) {
    const hasTim = (card.cost ?? []).some(
      (pip) => pip.trim().toUpperCase() === "TIM"
    )
    if (hasTim) stockpileTimCount += 1
  }
  return {
    pilotAsksTim: args.requestedColors.includes("TIM"),
    mapHasTim: args.resourceByColor.has("TIM"),
    stockpileTimCount,
  }
}

function stockpileColorCounts(
  stockpile: Array<{ cost?: string[] | null }>
): Map<ResourceColor, number> {
  const have = new Map<ResourceColor, number>()
  for (const card of stockpile) {
    let color: ResourceColor | null = null
    for (const raw of card.cost ?? []) {
      const pip = raw.trim().toUpperCase()
      if (pip === "GEN") {
        color = "STL"
        break
      }
      if ((RESOURCE_COLORS as readonly string[]).includes(pip)) {
        color = pip as ResourceColor
        break
      }
    }
    if (!color) continue
    have.set(color, (have.get(color) ?? 0) + 1)
  }
  return have
}

/**
 * Raise issued opening counts to at least what is sitting in `stockpile`.
 * A guest `tk` or the opening deal itself counts as issued — Delete later
 * must not look like "never spawned."
 */
export function observeOpeningFilledCounts(
  filled: ReadonlyMap<ResourceColor, number>,
  stockpile: Array<{ cost?: string[] | null }>
): Map<ResourceColor, number> {
  const next = new Map(filled)
  const have = stockpileColorCounts(stockpile)
  for (const [color, n] of have) {
    const prev = next.get(color) ?? 0
    if (n > prev) next.set(color, n)
  }
  return next
}

/**
 * Colours still owed to the opening deal: the catalogue can spawn them
 * and we have not yet issued that many. Live stockpile is not an input —
 * a deleted starting token stays deleted.
 */
export function unfilledOpeningColors(args: {
  needed: readonly ResourceColor[]
  resourceByColor: Map<ResourceColor, unknown>
  filledCounts: ReadonlyMap<ResourceColor, number>
}): ResourceColor[] {
  const want = new Map<ResourceColor, number>()
  for (const color of args.needed) {
    want.set(color, (want.get(color) ?? 0) + 1)
  }
  const missing: ResourceColor[] = []
  for (const [color, count] of want) {
    if (!args.resourceByColor.has(color)) continue
    const filled = args.filledCounts.get(color) ?? 0
    for (let i = filled; i < count; i++) missing.push(color)
  }
  return missing
}

/** Map gained a needed colour the placeholder never issued. */
export function guestPlaceholderCoverageImproved(args: {
  needed: readonly ResourceColor[]
  resourceByColor: Map<ResourceColor, unknown>
  filledCounts: ReadonlyMap<ResourceColor, number>
}): boolean {
  return unfilledOpeningColors(args).length > 0
}

/**
 * Colours the pilot asked for that the catalogue can spawn but the
 * stockpile does not yet have. Same identity as Generate resource.
 */
export function missingStartingResourceColors(args: {
  needed: readonly ResourceColor[]
  resourceByColor: Map<ResourceColor, unknown>
  stockpile: Array<{ cost?: string[] | null }>
}): ResourceColor[] {
  return unfilledOpeningColors({
    needed: args.needed,
    resourceByColor: args.resourceByColor,
    filledCounts: stockpileColorCounts(args.stockpile),
  })
}

/**
 * Guest local deal is only a placeholder until host fog arrives.
 * Rebuild once if the catalogue later covers a colour the first stamp skipped.
 */
export function guestMayPlaceholderDeal(args: {
  hasFog: boolean
  resourcesReady: boolean
  alreadyDealt: boolean
  coverageImproved?: boolean
}): boolean {
  if (args.hasFog) return false
  if (!args.resourcesReady) return false
  if (!args.alreadyDealt) return true
  return Boolean(args.coverageImproved)
}

/**
 * Host waits until resources are fetched and, in a room, the opponent deck
 * JSON exists. Missing pips are skipped at spawn — do not block the whole
 * opening for one colour (that left both seats with no library).
 */
export function hostOpeningMayCommit(args: {
  resourcesReady: boolean
  hasOpponentDeck: boolean
  requiresOpponentDeck: boolean
}): boolean {
  if (!args.resourcesReady) return false
  if (args.requiresOpponentDeck && !args.hasOpponentDeck) return false
  return true
}

/**
 * Seq-0 fog is the opening replace. If the host omitted a starting pip the
 * guest already spawned (same identity as Generate resource), keep those
 * tokens and stamp them into the same world fan as the fog stockpile so
 * Life/Time sit in one row. Later seq updates are host-authoritative.
 */
export function mergeOpeningStockpilePips(args: {
  seq: number
  owner: PlayerSlot
  incoming: PlayingCardInstance[]
  previous: PlayingCardInstance[]
}): PlayingCardInstance[] {
  if (args.seq !== 0) return args.incoming
  const prevStock = args.previous.filter(
    (card) => card.zone === "stockpile" && card.owner === args.owner
  )
  if (prevStock.length === 0) return args.incoming

  const incomingStock = args.incoming.filter(
    (card) => card.zone === "stockpile" && card.owner === args.owner
  )
  const have = stockpileColorCounts(incomingStock)
  const extra: PlayingCardInstance[] = []
  const seen = new Set(args.incoming.map((card) => card.instanceId))
  for (const card of prevStock) {
    if (seen.has(card.instanceId)) continue
    const counts = stockpileColorCounts([card])
    let missing = false
    for (const [color, n] of counts) {
      if ((have.get(color) ?? 0) < n) missing = true
    }
    if (!missing) continue
    extra.push(card)
    for (const [color, n] of counts) {
      have.set(color, (have.get(color) ?? 0) + n)
    }
  }
  if (extra.length === 0) return args.incoming

  const laidOut = stampStockpileWorldHomes(
    [...incomingStock, ...extra].map((card) => ({
      ...card,
      x: undefined,
      y: undefined,
    })),
    args.owner
  )
  const homeById = new Map(
    laidOut.map((card) => [card.instanceId, card] as const)
  )
  const placedExtra = extra.map((card) => {
    const home = homeById.get(card.instanceId)
    if (!home || home.x == null || home.y == null) return card
    return { ...card, x: home.x, y: home.y }
  })
  return [...args.incoming, ...placedExtra]
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

