/**
 * Deck-builder stats. Counts use in-deck quantities only.
 * Draw odds are hypergeometric. Ramp numbers state their assumptions.
 */

import {
  classifyCostToken,
  extractGainablePips,
  RESOURCE_COLORS,
  type GainablePip,
  type ResourceColor,
} from "@/components/Playtester/session/accumulateResources.logic"
import { parseKeyword } from "@/components/cards/keywordHelp.logic"
import {
  cardHasSuperType,
  categoryCountsInDeck,
  isAugmentCard,
  isObjectiveCard,
  objectiveCards,
  pilotCard,
} from "@/components/decks/deck.logic"
import { findKeywordAbility } from "@/lib/howToPlay/keywords"
import type { CardSummary } from "@/lib/api/cards"
import type {
  DeckCardEntry,
  DeckCategoryOut,
  DeckDetail,
} from "@/lib/api/decks"

export type Seat = "first" | "second"

export type RampColorCount = {
  id: ResourceColor
  count: number
}

export type RampGroup = {
  pips: number
  total: number
  colors: RampColorCount[]
}

export type StatFocus =
  | { kind: "cost"; cost: number }
  | { kind: "type"; typeName: string }
  | { kind: "card"; cardId: number }
  | { kind: "section"; categoryId: number }
  | { kind: "ramp"; pips: number }

export type DeckColorSlice = {
  id: string
  count: number
  share: number
}

export type ColorCount = {
  id: ResourceColor
  count: number
  share: number
}

export type NamedCount = {
  name: string
  count: number
}

export type CurveBin = {
  cost: number
  count: number
}

export type StatCard = {
  id: number
  name: string
  quantity: number
  invokeCost: number | null
  categoryId: number
  categoryName: string
  cost: string[]
  types: string[]
}

export type LegalReport = {
  size: number
  sizeOk: boolean
  pilotCount: number
  pilotOk: boolean
  objectiveCount: number
  augmentCount: number
  sideOk: boolean
  copiesOk: boolean
  prototypeOk: boolean
}

export type UnitReport = {
  count: number
  averageDamage: number | null
  averageHealth: number | null
  health: NamedCount[]
  damage: NamedCount[]
  keywords: NamedCount[]
  programs: number
  technologies: number
  quickHacks: number
}

export type DeckStatsModel = {
  deckSize: number
  handSize: number
  legal: LegalReport
  curve: CurveBin[]
  noCost: number
  meanInvoke: number | null
  sections: {
    id: number
    name: string
    count: number
    share: number
  }[]
  pipColors: ColorCount[]
  hybridPips: number
  cardColors: ColorCount[]
  rampQuality: RampGroup[]
  superTypes: NamedCount[]
  speeds: NamedCount[]
  units: UnitReport
  cards: StatCard[]
  stockpile: Record<ResourceColor, number>
  life: number
  rampWeights: Record<ResourceColor, number>
  deckColors: DeckColorSlice[]
}

export type DrawReport = {
  label: string
  matched: number
  seen: number
  atLeastOne: number
  exactlyOne: number
  twoOrMore: number
  sectionName: string
  sectionShare: number
}

export type PayPlan = {
  payTurn: number | null
  resolveTurn: number | null
  usesTime: boolean
  variable: boolean
}

const MAX_PAY_TURN = 30
const COPY_LIMIT = 3
const DECK_MIN = 40
const DECK_MAX = 100

export function cardsSeen(
  hand: number,
  turn: number,
  seat: Seat
): number {
  const safeTurn = Math.max(1, Math.floor(turn))
  const safeHand = Math.max(0, hand)
  if (seat === "first") {
    return safeHand + Math.max(0, safeTurn - 1)
  }
  return safeHand + safeTurn
}

export function deckOutTurn(
  remaining: number,
  perTurn: number,
  seat: Seat
): number {
  const startTurn = seat === "first" ? 2 : 1
  if (perTurn < 1) return startTurn
  if (remaining <= 0) return startTurn
  return Math.floor(remaining / perTurn) + startTurn
}

export function hypergeometricExactly(
  deckSize: number,
  matched: number,
  seen: number,
  copies: number
): number {
  if (copies < 0 || copies > matched || copies > seen) return 0
  if (seen - copies > deckSize - matched) return 0
  if (seen > deckSize || deckSize <= 0) return 0
  let value = 1
  for (let index = 1; index <= copies; index += 1) {
    value *= (matched - copies + index) / index
  }
  const rest = seen - copies
  for (let index = 1; index <= rest; index += 1) {
    value *= (deckSize - matched - rest + index) / index
  }
  for (let index = 1; index <= seen; index += 1) {
    value *= index / (deckSize - seen + index)
  }
  return value
}

export function hypergeometricAtLeastOne(
  deckSize: number,
  matched: number,
  seen: number
): number {
  if (matched <= 0 || seen <= 0 || deckSize <= 0) return 0
  const cappedSeen = Math.min(seen, deckSize)
  const cappedMatched = Math.min(matched, deckSize)
  if (cappedSeen > deckSize - cappedMatched) return 1
  let missed = 1
  for (let index = 0; index < cappedSeen; index += 1) {
    missed *= (deckSize - cappedMatched - index) / (deckSize - index)
  }
  return 1 - missed
}

function emptyColors(): Record<ResourceColor, number> {
  return {
    LIF: 0,
    MET: 0,
    POW: 0,
    RAM: 0,
    TIM: 0,
    STL: 0,
  }
}

function copyColors(
  source: Record<ResourceColor, number>
): Record<ResourceColor, number> {
  return { ...source }
}

function colorTotal(source: Record<ResourceColor, number>): number {
  let total = 0
  for (const color of RESOURCE_COLORS) {
    total += source[color]
  }
  return total
}

function inDeckEntries(deck: DeckDetail): DeckCardEntry[] {
  const ids = new Set(
    deck.categories.filter(categoryCountsInDeck).map((row) => row.id)
  )
  return deck.cards.filter((entry) => ids.has(entry.category_id))
}

function categoryName(
  categories: DeckCategoryOut[],
  categoryId: number
): string {
  const found = categories.find((row) => row.id === categoryId)
  if (!found) return "Section"
  return found.name
}

function hasCost(card: CardSummary): boolean {
  return card.has_invoke_cost !== false
}

function typeNames(card: CardSummary): string[] {
  const names: string[] = []
  for (const raw of card.super_types ?? []) {
    const text = String(raw).trim()
    if (text) names.push(text)
  }
  for (const raw of card.sub_types ?? []) {
    const text = String(raw).trim()
    if (text) names.push(text)
  }
  return names
}

function hasType(card: CardSummary, typeName: string): boolean {
  const needle = typeName.trim().toLowerCase()
  return typeNames(card).some(
    (name) => name.toLowerCase() === needle
  )
}

function titleCaseWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function keywordStatName(raw: string): string {
  const parsed = parseKeyword(raw)
  if (!parsed.name) return ""
  const ability = findKeywordAbility(parsed.name)
  if (!ability) return parsed.name
  const base = ability.name.replace(/\s+X$/i, "")
  return titleCaseWords(base)
}

function parseTlv(
  raw: string | undefined
): { damage: number; health: number } | null {
  const text = (raw ?? "").trim()
  if (text === "") return null
  if (text.includes("|")) {
    const parts = text.split("|")
    const damage = Number(parts[0])
    const health = Number(parts[1])
    if (!Number.isFinite(damage) || !Number.isFinite(health)) {
      return null
    }
    return { damage, health }
  }
  const value = Number(text)
  if (!Number.isFinite(value)) return null
  return { damage: value, health: value }
}

function genericPips(
  token: string
): { amount: number; variable: boolean } | null {
  if (token === "GENX") return { amount: 0, variable: true }
  if (token === "GEN") return { amount: 1, variable: false }
  const match = /^GEN(\d+)$/.exec(token)
  if (!match) return null
  return { amount: Number(match[1]), variable: false }
}

type ParsedCost = {
  solids: Record<ResourceColor, number>
  hybrids: [ResourceColor, ResourceColor][]
  generic: number
  variable: boolean
}

function parsePayment(cost: string[]): ParsedCost {
  const solids = emptyColors()
  const hybrids: [ResourceColor, ResourceColor][] = []
  let generic = 0
  let variable = false
  for (const raw of cost) {
    const token = raw.trim().toUpperCase()
    if (!token) continue
    const genericPart = genericPips(token)
    if (genericPart) {
      generic += genericPart.amount
      if (genericPart.variable) variable = true
      continue
    }
    const pip = classifyCostToken(token)
    if (pip?.kind === "solid") solids[pip.color] += 1
    if (pip?.kind === "hybrid") hybrids.push(pip.colors)
  }
  return { solids, hybrids, generic, variable }
}

export function formatCost(cost: string[]): string {
  const solids = new Map<string, number>()
  const generics: string[] = []
  for (const raw of cost) {
    const token = raw.trim().toUpperCase()
    if (!token) continue
    if (genericPips(token)) {
      generics.push(token)
      continue
    }
    solids.set(token, (solids.get(token) ?? 0) + 1)
  }
  const parts: string[] = []
  for (const [token, count] of solids) {
    if (count === 1) parts.push(token)
    else parts.push(`${count} ${token}`)
  }
  for (const token of generics) parts.push(token)
  if (parts.length === 0) return "no cost"
  return parts.join(" + ")
}

function pilotCount(deck: DeckDetail): number {
  const section = deck.categories.find(
    (row) => row.name.trim().toLowerCase() === "pilot"
  )
  if (!section) return 0
  let total = 0
  for (const entry of deck.cards) {
    if (entry.category_id !== section.id) continue
    total += entry.quantity
  }
  return total
}

function isExtraHardPoint(entry: DeckCardEntry): boolean {
  const name = entry.card.card_name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
  if (name === "extra hard point") return true
  if (name === "extra hardpoint") return true
  return false
}

function sideReport(deck: DeckDetail): {
  objectiveCount: number
  augmentCount: number
  sideOk: boolean
} {
  const rows = objectiveCards(deck.cards, deck.categories, "name")
  let objectiveCount = 0
  let augmentCount = 0
  let other = 0
  let hardPoint = false
  for (const entry of rows) {
    if (isExtraHardPoint(entry) && entry.quantity > 0) {
      hardPoint = true
    }
    if (isAugmentCard(entry)) {
      augmentCount += entry.quantity
      continue
    }
    if (isObjectiveCard(entry)) {
      objectiveCount += entry.quantity
      continue
    }
    other += entry.quantity
  }
  const sideTotal = hardPoint ? 5 : 3
  const maxAugments = hardPoint ? 4 : 2
  const sideOk =
    other === 0 &&
    objectiveCount + augmentCount === sideTotal &&
    augmentCount <= maxAugments &&
    objectiveCount >= 1
  return { objectiveCount, augmentCount, sideOk }
}

function copiesOk(entries: DeckCardEntry[]): boolean {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    const name = entry.card.card_name.trim().toLowerCase()
    totals.set(name, (totals.get(name) ?? 0) + entry.quantity)
  }
  for (const total of totals.values()) {
    if (total > COPY_LIMIT) return false
  }
  return true
}

function prototypeOk(entries: DeckCardEntry[]): boolean {
  const totals = new Map<number, number>()
  for (const entry of entries) {
    if (!cardHasSuperType(entry, "Prototype")) continue
    const next = (totals.get(entry.card.id) ?? 0) + entry.quantity
    totals.set(entry.card.id, next)
  }
  for (const total of totals.values()) {
    if (total > 1) return false
  }
  return true
}

function curveOf(entries: DeckCardEntry[]): {
  curve: CurveBin[]
  noCost: number
  meanInvoke: number | null
} {
  const bins = new Map<number, number>()
  let noCost = 0
  let weighted = 0
  let counted = 0
  for (const entry of entries) {
    if (!hasCost(entry.card)) {
      noCost += entry.quantity
      continue
    }
    const cost = entry.card.invoke_cost ?? 0
    bins.set(cost, (bins.get(cost) ?? 0) + entry.quantity)
    weighted += cost * entry.quantity
    counted += entry.quantity
  }
  const curve = [...bins.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([cost, count]) => ({ cost, count }))
  const meanInvoke = counted === 0 ? null : weighted / counted
  return { curve, noCost, meanInvoke }
}

function sectionRows(
  deck: DeckDetail,
  entries: DeckCardEntry[],
  deckSize: number
): DeckStatsModel["sections"] {
  const counts = new Map<number, number>()
  for (const entry of entries) {
    counts.set(
      entry.category_id,
      (counts.get(entry.category_id) ?? 0) + entry.quantity
    )
  }
  const rows = deck.categories
    .filter(categoryCountsInDeck)
    .map((category) => {
      const count = counts.get(category.id) ?? 0
      const share = deckSize === 0 ? 0 : count / deckSize
      return {
        id: category.id,
        name: category.name,
        count,
        share,
      }
    })
  return rows.filter((row) => row.count > 0)
}

function addPipColors(
  card: CardSummary,
  quantity: number,
  solids: Record<ResourceColor, number>,
  hybrid: { count: number }
): void {
  for (const raw of card.cost ?? []) {
    const pip = classifyCostToken(String(raw))
    if (!pip || pip.kind === "multi") continue
    if (pip.kind === "solid") {
      solids[pip.color] += quantity
      continue
    }
    hybrid.count += quantity
  }
}

function cardColorHits(
  card: CardSummary
): Set<ResourceColor> {
  const hits = new Set<ResourceColor>()
  for (const raw of card.cost ?? []) {
    const pip = classifyCostToken(String(raw))
    if (!pip || pip.kind === "multi") continue
    if (pip.kind === "solid") hits.add(pip.color)
    if (pip.kind === "hybrid") {
      hits.add(pip.colors[0])
      hits.add(pip.colors[1])
    }
  }
  return hits
}

const DECK_COLOR_ORDER = [
  ...RESOURCE_COLORS,
  "GREY",
  "NONE",
]

function deckColorHits(card: CardSummary): string[] {
  const colors = new Set<string>()
  let grey = false
  for (const raw of card.cost ?? []) {
    const token = String(raw).trim().toUpperCase()
    if (!token) continue
    if (genericPips(token)) {
      grey = true
      continue
    }
    const pip = classifyCostToken(token)
    if (pip?.kind === "solid") colors.add(pip.color)
    if (pip?.kind === "hybrid") {
      colors.add(pip.colors[0])
      colors.add(pip.colors[1])
    }
  }
  if (colors.size > 0) return [...colors]
  if (grey) return ["GREY"]
  return ["NONE"]
}

function deckColorSlices(
  entries: DeckCardEntry[],
  deckSize: number
): DeckColorSlice[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const id of deckColorHits(entry.card)) {
      counts.set(id, (counts.get(id) ?? 0) + entry.quantity)
    }
  }
  const rows: DeckColorSlice[] = []
  for (const id of DECK_COLOR_ORDER) {
    const count = counts.get(id) ?? 0
    if (count <= 0) continue
    const share = deckSize === 0 ? 0 : count / deckSize
    rows.push({ id, count, share })
  }
  return rows
}

function colorShares(
  counts: Record<ResourceColor, number>,
  total: number
): ColorCount[] {
  const rows: ColorCount[] = []
  for (const color of RESOURCE_COLORS) {
    const count = counts[color]
    if (count <= 0) continue
    const share = total === 0 ? 0 : count / total
    rows.push({ id: color, count, share })
  }
  return rows
}

function namedCounts(totals: Map<string, number>): NamedCount[] {
  return [...totals.entries()]
    .filter((row) => row[1] > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => ({ name, count }))
}

function bump(map: Map<string, number>, name: string, amount: number) {
  map.set(name, (map.get(name) ?? 0) + amount)
}

function unitsOf(entries: DeckCardEntry[]): UnitReport {
  let count = 0
  let damageSum = 0
  let healthSum = 0
  let rated = 0
  const healthBins = new Map<string, number>()
  const damageBins = new Map<string, number>()
  const keywordTotals = new Map<string, number>()
  const report: UnitReport = {
    count: 0,
    averageDamage: null,
    averageHealth: null,
    health: [],
    damage: [],
    keywords: [],
    programs: 0,
    technologies: 0,
    quickHacks: 0,
  }
  for (const entry of entries) {
    const card = entry.card
    const quantity = entry.quantity
    for (const raw of card.keywords ?? []) {
      const label = keywordStatName(String(raw))
      if (!label) continue
      bump(keywordTotals, label, quantity)
    }
    if (hasType(card, "Quick Hack")) report.quickHacks += quantity
    const isUnit = cardHasSuperType(entry, "Unit")
    if (cardHasSuperType(entry, "Program") && !isUnit) {
      report.programs += quantity
    }
    if (cardHasSuperType(entry, "Technology") && !isUnit) {
      report.technologies += quantity
    }
    if (card.has_tlv !== true) continue
    const parsed = parseTlv(card.threat_level)
    if (!parsed) continue
    count += quantity
    rated += quantity
    damageSum += parsed.damage * quantity
    healthSum += parsed.health * quantity
    bump(
      healthBins,
      String(Math.round(parsed.health)),
      quantity
    )
    bump(
      damageBins,
      String(Math.round(parsed.damage)),
      quantity
    )
  }
  report.count = count
  report.health = [...healthBins.entries()]
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([name, healthCount]) => ({ name, count: healthCount }))
  report.damage = [...damageBins.entries()]
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([name, damageCount]) => ({ name, count: damageCount }))
  report.keywords = namedCounts(keywordTotals)
  if (rated > 0) {
    report.averageDamage = damageSum / rated
    report.averageHealth = healthSum / rated
  }
  return report
}

function statCards(
  deck: DeckDetail,
  entries: DeckCardEntry[]
): StatCard[] {
  const rows = new Map<number, StatCard>()
  for (const entry of entries) {
    const existing = rows.get(entry.card.id)
    const invokeCost = hasCost(entry.card)
      ? entry.card.invoke_cost ?? 0
      : null
    if (!existing) {
      rows.set(entry.card.id, {
        id: entry.card.id,
        name: entry.card.card_name,
        quantity: entry.quantity,
        invokeCost,
        categoryId: entry.category_id,
        categoryName: categoryName(
          deck.categories,
          entry.category_id
        ),
        cost: [...(entry.card.cost ?? [])],
        types: typeNames(entry.card),
      })
      continue
    }
    existing.quantity += entry.quantity
  }
  return [...rows.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

function stockpileOf(
  card: CardSummary | null
): Record<ResourceColor, number> {
  const colors = emptyColors()
  if (!card) return colors
  colors.LIF = card.spirit_capacity ?? 0
  colors.MET = card.metal_capacity ?? 0
  colors.POW = card.power_capacity ?? 0
  colors.RAM = card.ram_capacity ?? 0
  colors.TIM = card.time_capacity ?? 0
  colors.STL = card.steel_capacity ?? 0
  return colors
}

export function gainablePipCount(
  cost: string[] | null | undefined
): number {
  return extractGainablePips(cost).length
}

export function rampBandOf(
  cost: string[] | null | undefined
): number {
  const count = gainablePipCount(cost)
  if (count >= 2) return 2
  return count
}

export function rampBandLabel(pips: number): string {
  if (pips === 1) return "1 pip"
  if (pips >= 2) return "2+ pips"
  return "0 pips"
}

function colorsOn(pips: GainablePip[]): ResourceColor[] {
  const found = new Set<ResourceColor>()
  for (const pip of pips) {
    if (pip.kind === "solid") found.add(pip.color)
    if (pip.kind === "hybrid") {
      found.add(pip.colors[0])
      found.add(pip.colors[1])
    }
  }
  return [...found]
}

function rampGroupsOf(entries: DeckCardEntry[]): RampGroup[] {
  const totals = new Map<number, number>()
  const colors = new Map<number, Record<ResourceColor, number>>()
  for (const entry of entries) {
    const pips = extractGainablePips(entry.card.cost)
    const count = rampBandOf(entry.card.cost)
    const next = (totals.get(count) ?? 0) + entry.quantity
    totals.set(count, next)
    const bucket = colors.get(count) ?? emptyColors()
    for (const color of colorsOn(pips)) {
      bucket[color] += entry.quantity
    }
    colors.set(count, bucket)
  }
  const groups: RampGroup[] = []
  const keys = [...totals.keys()]
  keys.sort((left, right) => left - right)
  for (const pips of keys) {
    const bucket = colors.get(pips) ?? emptyColors()
    const slices = RESOURCE_COLORS
      .map((id) => ({ id, count: bucket[id] }))
      .filter((row) => row.count > 0)
    slices.sort((left, right) => right.count - left.count)
    groups.push({
      pips,
      total: totals.get(pips) ?? 0,
      colors: slices,
    })
  }
  return groups
}

function rampWeightsOf(
  entries: DeckCardEntry[]
): Record<ResourceColor, number> {
  const weights = emptyColors()
  for (const entry of entries) {
    for (const raw of entry.card.cost ?? []) {
      const pip = classifyCostToken(String(raw))
      if (!pip || pip.kind === "multi") continue
      if (pip.kind === "solid") {
        weights[pip.color] += entry.quantity
        continue
      }
      weights[pip.colors[0]] += entry.quantity
      weights[pip.colors[1]] += entry.quantity
    }
  }
  return weights
}

export function buildDeckStats(deck: DeckDetail): DeckStatsModel {
  const entries = inDeckEntries(deck)
  let deckSize = 0
  for (const entry of entries) deckSize += entry.quantity
  const curve = curveOf(entries)
  const side = sideReport(deck)
  const pilot = pilotCard(deck.cards, deck.categories)
  const solids = emptyColors()
  const hybrid = { count: 0 }
  const cardHits = emptyColors()
  const supers = new Map<string, number>()
  const speeds = new Map<string, number>()
  for (const entry of entries) {
    addPipColors(entry.card, entry.quantity, solids, hybrid)
    for (const color of cardColorHits(entry.card)) {
      cardHits[color] += entry.quantity
    }
    for (const name of entry.card.super_types ?? []) {
      const text = String(name).trim()
      if (text) bump(supers, text, entry.quantity)
    }
    if (hasType(entry.card, "Process")) {
      bump(speeds, "Process", entry.quantity)
    }
    if (hasType(entry.card, "Quick Hack")) {
      bump(speeds, "Quick Hack", entry.quantity)
    }
  }
  const pipTotal = colorTotal(solids) + hybrid.count
  return {
    deckSize,
    handSize: pilot?.card.hand_size ?? 0,
    legal: {
      size: deckSize,
      sizeOk: deckSize >= DECK_MIN && deckSize <= DECK_MAX,
      pilotCount: pilotCount(deck),
      pilotOk: pilotCount(deck) === 1,
      objectiveCount: side.objectiveCount,
      augmentCount: side.augmentCount,
      sideOk: side.sideOk,
      copiesOk: copiesOk(entries),
      prototypeOk: prototypeOk(entries),
    },
    curve: curve.curve,
    noCost: curve.noCost,
    meanInvoke: curve.meanInvoke,
    sections: sectionRows(deck, entries, deckSize),
    pipColors: colorShares(solids, pipTotal),
    hybridPips: hybrid.count,
    cardColors: colorShares(cardHits, deckSize),
    rampQuality: rampGroupsOf(entries),
    superTypes: namedCounts(supers),
    speeds: namedCounts(speeds),
    units: unitsOf(entries),
    cards: statCards(deck, entries),
    stockpile: stockpileOf(pilot?.card ?? null),
    life: pilot?.card.lif_capacity ?? 0,
    rampWeights: rampWeightsOf(entries),
    deckColors: deckColorSlices(entries, deckSize),
  }
}

export function defaultFocus(model: DeckStatsModel): StatFocus {
  let best: CurveBin | null = null
  for (const bin of model.curve) {
    if (!best || bin.count > best.count) best = bin
  }
  if (!best) return { kind: "cost", cost: 0 }
  return { kind: "cost", cost: best.cost }
}

function entryMatches(entry: DeckCardEntry, focus: StatFocus): boolean {
  if (focus.kind === "cost") {
    if (!hasCost(entry.card)) return false
    return (entry.card.invoke_cost ?? 0) === focus.cost
  }
  if (focus.kind === "type") return hasType(entry.card, focus.typeName)
  if (focus.kind === "card") return entry.card.id === focus.cardId
  if (focus.kind === "ramp") {
    return rampBandOf(entry.card.cost) === focus.pips
  }
  return entry.category_id === focus.categoryId
}

function focusLabel(model: DeckStatsModel, focus: StatFocus): string {
  if (focus.kind === "cost") return `cost ${focus.cost}`
  if (focus.kind === "type") return focus.typeName
  if (focus.kind === "ramp") return rampBandLabel(focus.pips)
  if (focus.kind === "section") {
    const section = model.sections.find(
      (row) => row.id === focus.categoryId
    )
    return section?.name ?? "section"
  }
  const card = model.cards.find((row) => row.id === focus.cardId)
  return card?.name ?? "card"
}

function focusSection(
  model: DeckStatsModel,
  entries: DeckCardEntry[],
  focus: StatFocus
): { name: string; share: number } {
  if (focus.kind === "section") {
    const section = model.sections.find(
      (row) => row.id === focus.categoryId
    )
    return {
      name: section?.name ?? "section",
      share: section?.share ?? 0,
    }
  }
  if (focus.kind === "card") {
    const card = model.cards.find((row) => row.id === focus.cardId)
    const section = model.sections.find(
      (row) => row.id === card?.categoryId
    )
    return {
      name: section?.name ?? "section",
      share: section?.share ?? 0,
    }
  }
  const totals = new Map<number, number>()
  for (const entry of entries) {
    if (!entryMatches(entry, focus)) continue
    totals.set(
      entry.category_id,
      (totals.get(entry.category_id) ?? 0) + entry.quantity
    )
  }
  let bestId: number | null = null
  let bestCount = -1
  for (const [id, count] of totals) {
    if (count > bestCount) {
      bestId = id
      bestCount = count
    }
  }
  const section = model.sections.find((row) => row.id === bestId)
  return {
    name: section?.name ?? "section",
    share: section?.share ?? 0,
  }
}

export function drawReport(
  deck: DeckDetail,
  model: DeckStatsModel,
  focus: StatFocus,
  seat: Seat,
  turn: number
): DrawReport {
  const entries = inDeckEntries(deck)
  let matched = 0
  for (const entry of entries) {
    if (!entryMatches(entry, focus)) continue
    matched += entry.quantity
  }
  const seen = Math.min(
    model.deckSize,
    cardsSeen(model.handSize, turn, seat)
  )
  const atLeastOne = hypergeometricAtLeastOne(
    model.deckSize,
    matched,
    seen
  )
  const exactlyOne = hypergeometricExactly(
    model.deckSize,
    matched,
    seen,
    1
  )
  const none = hypergeometricExactly(
    model.deckSize,
    matched,
    seen,
    0
  )
  let twoOrMore = 1 - none - exactlyOne
  if (twoOrMore < 0) twoOrMore = 0
  const section = focusSection(model, entries, focus)
  return {
    label: focusLabel(model, focus),
    matched,
    seen,
    atLeastOne,
    exactlyOne,
    twoOrMore,
    sectionName: section.name,
    sectionShare: section.share,
  }
}

function splitRamp(
  rate: number,
  weights: Record<ResourceColor, number>
): Record<ResourceColor, number> {
  const out = emptyColors()
  const total = colorTotal(weights)
  const wholeRate = Math.max(0, Math.floor(rate))
  if (wholeRate === 0 || total <= 0) return out
  const rows = RESOURCE_COLORS.map((color) => {
    const exact = (wholeRate * weights[color]) / total
    const whole = Math.floor(exact)
    out[color] = whole
    return { color, fraction: exact - whole }
  })
  const used = colorTotal(out)
  let left = wholeRate - used
  rows.sort((leftRow, rightRow) => rightRow.fraction - leftRow.fraction)
  for (const row of rows) {
    if (left <= 0) break
    out[row.color] += 1
    left -= 1
  }
  return out
}

function expendLeastUseful(
  pool: Record<ResourceColor, number>,
  count: number,
  needed: Record<ResourceColor, number>
): void {
  let left = count
  while (left > 0) {
    let pick: ResourceColor | null = null
    let best = -Infinity
    for (const color of RESOURCE_COLORS) {
      if (pool[color] <= 0) continue
      const surplus = pool[color] - needed[color]
      if (surplus > best) {
        best = surplus
        pick = color
      }
    }
    if (!pick) return
    pool[pick] -= 1
    left -= 1
  }
}

function poolOnTurn(
  model: DeckStatsModel,
  turn: number,
  seat: Seat,
  rampRate: number,
  needed: Record<ResourceColor, number>
): Record<ResourceColor, number> {
  const added = splitRamp(rampRate * turn, model.rampWeights)
  const pool = copyColors(model.stockpile)
  for (const color of RESOURCE_COLORS) {
    pool[color] += added[color]
  }
  if (seat !== "first" || turn !== 1) return pool
  const kept = copyColors(model.stockpile)
  const expend = Math.min(2, colorTotal(model.stockpile))
  expendLeastUseful(kept, expend, needed)
  for (const color of RESOURCE_COLORS) {
    const removed = model.stockpile[color] - kept[color]
    pool[color] -= removed
  }
  return pool
}

function payColors(
  pool: Record<ResourceColor, number>,
  cost: ParsedCost
): { ok: boolean; genericShort: number } {
  const left = copyColors(pool)
  for (const color of RESOURCE_COLORS) {
    if (left[color] < cost.solids[color]) {
      return { ok: false, genericShort: cost.generic }
    }
    left[color] -= cost.solids[color]
  }
  for (const [first, second] of cost.hybrids) {
    if (left[first] >= left[second] && left[first] > 0) {
      left[first] -= 1
      continue
    }
    if (left[second] > 0) {
      left[second] -= 1
      continue
    }
    return { ok: false, genericShort: cost.generic }
  }
  const genericShort = Math.max(0, cost.generic - colorTotal(left))
  return { ok: true, genericShort }
}

export function payPlanForCost(
  model: DeckStatsModel,
  cost: string[],
  seat: Seat,
  rampRate: number
): PayPlan {
  const parsed = parsePayment(cost)
  let best: { pay: number; resolve: number } | null = null
  for (let turn = 1; turn <= MAX_PAY_TURN; turn += 1) {
    const pool = poolOnTurn(
      model,
      turn,
      seat,
      rampRate,
      parsed.solids
    )
    const paid = payColors(pool, parsed)
    if (!paid.ok) continue
    const resolve = turn + paid.genericShort
    const better =
      best == null ||
      resolve < best.resolve ||
      (resolve === best.resolve && turn < best.pay)
    if (!better) continue
    best = { pay: turn, resolve }
  }
  if (!best) {
    return {
      payTurn: null,
      resolveTurn: null,
      usesTime: false,
      variable: parsed.variable,
    }
  }
  return {
    payTurn: best.pay,
    resolveTurn: best.resolve,
    usesTime: best.resolve > best.pay,
    variable: parsed.variable,
  }
}

export function resourceNeed(cost: string[]): number {
  const parsed = parsePayment(cost)
  let need = parsed.generic + parsed.hybrids.length
  for (const color of RESOURCE_COLORS) {
    need += parsed.solids[color]
  }
  return need
}

export function startingStockpileForSeat(
  stockpile: number,
  seat: Seat
): number {
  const safe = Math.max(0, Math.floor(stockpile))
  if (seat === "first") return Math.max(0, safe - 2)
  return safe
}

export function playTurnForRate(
  stockpile: number,
  needed: number,
  rate: number
): number {
  if (needed <= stockpile) return 1
  if (rate <= 0) return MAX_PAY_TURN
  const short = needed - stockpile
  return Math.ceil(short / rate)
}

export function targetCard(model: DeckStatsModel): StatCard | null {
  let best: StatCard | null = null
  for (const card of model.cards) {
    if (card.invokeCost == null) continue
    if (!best || card.invokeCost > (best.invokeCost ?? 0)) {
      best = card
    }
  }
  return best
}

export function timeWaitQuantity(
  model: DeckStatsModel,
  seat: Seat,
  rampRate: number
): number {
  let waiting = 0
  for (const card of model.cards) {
    if (card.invokeCost == null) continue
    const plan = payPlanForCost(model, card.cost, seat, rampRate)
    if (!plan.usesTime) continue
    waiting += card.quantity
  }
  return waiting
}

export function poolAtTurn(
  model: DeckStatsModel,
  seat: Seat,
  turn: number,
  rampRate: number
): Record<ResourceColor, number> {
  return poolOnTurn(
    model,
    turn,
    seat,
    rampRate,
    emptyColors()
  )
}

export function percentLabel(value: number): string {
  const clamped = Math.min(1, Math.max(0, value))
  return `${Math.round(clamped * 100)}%`
}
