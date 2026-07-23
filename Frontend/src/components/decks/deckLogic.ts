/**
 * Pure deck-builder helpers (sorting, sections, selection, quantity rules).
 */

import type { DeckCardSortMode } from "@/components/decks/DeckCardSortControls"
import {
  DECK_CARD_MAX_COPIES,
  deckCardSelectionKey,
} from "@/components/decks/DeckCardStack"
import {
  AUGMENT_SECTION_NAME,
  PILOT_SECTION_NAME,
  type DeckCardEntry,
  type DeckCategoryOut,
  type DeckDetail,
} from "@/lib/api/decks"

export function isPilotCategory(category: DeckCategoryOut): boolean {
  return category.name.trim().toLowerCase() === PILOT_SECTION_NAME.toLowerCase()
}

export function isAugmentCategory(category: DeckCategoryOut): boolean {
  return (
    category.name.trim().toLowerCase() === AUGMENT_SECTION_NAME.toLowerCase()
  )
}

export function isReservedCategory(category: DeckCategoryOut): boolean {
  return isPilotCategory(category) || isAugmentCategory(category)
}

export function sortDeckCards(
  cards: DeckCardEntry[],
  mode: DeckCardSortMode
): DeckCardEntry[] {
  return [...cards].sort((a, b) => {
    if (mode === "invoke") {
      const byCost = (a.invoke_cost ?? 0) - (b.invoke_cost ?? 0)
      if (byCost !== 0) return byCost
      return a.card_name.localeCompare(b.card_name)
    }
    if (mode === "type") {
      const byType = (a.types_line || "").localeCompare(b.types_line || "")
      if (byType !== 0) return byType
      return a.card_name.localeCompare(b.card_name)
    }
    return a.card_name.localeCompare(b.card_name)
  })
}

export function cardsByCategory(
  cards: DeckCardEntry[],
  categories: DeckCategoryOut[],
  sortMode: DeckCardSortMode
): { category: DeckCategoryOut; cards: DeckCardEntry[] }[] {
  return categories
    .filter((category) => !isReservedCategory(category))
    .map((category) => ({
      category,
      cards: sortDeckCards(
        cards.filter((card) => card.category_id === category.id),
        sortMode
      ),
    }))
}

export function mainCategoryId(categories: DeckCategoryOut[]): number | null {
  const main = categories.find((c) => c.name.trim().toLowerCase() === "main")
  if (main) return main.id
  const playable = categories.filter((c) => !isReservedCategory(c))
  const first = [...playable].sort((a, b) => a.sort_order - b.sort_order)[0]
  return first?.id ?? null
}

export function pilotCategory(
  categories: DeckCategoryOut[]
): DeckCategoryOut | null {
  return categories.find(isPilotCategory) ?? null
}

export function augmentCategory(
  categories: DeckCategoryOut[]
): DeckCategoryOut | null {
  return categories.find(isAugmentCategory) ?? null
}

export function pilotCard(
  cards: DeckCardEntry[],
  categories: DeckCategoryOut[]
): DeckCardEntry | null {
  const cat = pilotCategory(categories)
  if (!cat) return null
  return cards.find((card) => card.category_id === cat.id) ?? null
}

export function augmentCards(
  cards: DeckCardEntry[],
  categories: DeckCategoryOut[],
  sortMode: DeckCardSortMode
): DeckCardEntry[] {
  const cat = augmentCategory(categories)
  if (!cat) return []
  return sortDeckCards(
    cards.filter((card) => card.category_id === cat.id),
    sortMode
  )
}

/** Visual order used for Shift+click range selection. */
export function selectableCardsInOrder(
  cards: DeckCardEntry[],
  categories: DeckCategoryOut[],
  sortMode: DeckCardSortMode
): DeckCardEntry[] {
  return [
    ...augmentCards(cards, categories, sortMode),
    ...cardsByCategory(cards, categories, sortMode).flatMap(
      (group) => group.cards
    ),
  ]
}

export function withCardEntry(
  prev: DeckDetail,
  entry: DeckCardEntry
): DeckDetail {
  const withoutDup = prev.cards.filter(
    (card) =>
      !(
        card.card_id === entry.card_id && card.category_id === entry.category_id
      )
  )
  const cards = [...withoutDup, entry]
  return {
    ...prev,
    cards,
    card_count: cards.reduce((sum, card) => sum + card.quantity, 0),
  }
}

export function removeCardEntry(
  cards: DeckCardEntry[],
  cardId: number,
  categoryId: number
): DeckCardEntry[] {
  return cards.filter(
    (card) => !(card.card_id === cardId && card.category_id === categoryId)
  )
}

/** Apply a moved/updated card into a working list (drop source + target dup). */
export function applyCardMove(
  workingCards: DeckCardEntry[],
  fromCategoryId: number,
  updated: DeckCardEntry
): DeckCardEntry[] {
  const withoutSource = removeCardEntry(
    workingCards,
    updated.card_id,
    fromCategoryId
  )
  return [
    ...removeCardEntry(withoutSource, updated.card_id, updated.category_id),
    updated,
  ]
}

export function deckCardCount(cards: DeckCardEntry[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0)
}

export function maxCopiesForCategory(category: DeckCategoryOut): number {
  return isAugmentCategory(category) ? 1 : DECK_CARD_MAX_COPIES
}

/**
 * Next quantity after ±1, or `null` when the change is not allowed,
 * or `0` when the card should be removed from the deck.
 */
export function nextCardQuantity(
  quantity: number,
  delta: 1 | -1,
  maxCopies: number
): number | null {
  if (delta > 0 && quantity >= maxCopies) return null
  return quantity + delta
}

/** Unique name for a section created via the new-section drop zone. */
export function nextNewSectionName(existingNames: Iterable<string>): string {
  const taken = new Set(
    [...existingNames].map((name) => name.trim().toLowerCase())
  )
  let name = "New Section"
  let n = 2
  while (taken.has(name.toLowerCase())) {
    name = `New Section ${n}`
    n += 1
  }
  return name
}

export function canAddCopyToMain(
  existingQuantity: number | undefined
): { ok: true } | { ok: false; message: string } {
  if ((existingQuantity ?? 0) >= DECK_CARD_MAX_COPIES) {
    return {
      ok: false,
      message: `Main already has ${DECK_CARD_MAX_COPIES} copies of that card.`,
    }
  }
  return { ok: true }
}

export function clampQuantityToMax(
  quantity: number,
  maxCopies: number = DECK_CARD_MAX_COPIES
): number {
  return Math.min(quantity, maxCopies)
}

export function toggleSelectionKey(
  selected: ReadonlySet<string>,
  key: string
): Set<string> {
  const next = new Set(selected)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

/** Shift+click range between anchor and target in visual board order. */
export function selectionRangeKeys(
  orderedKeys: string[],
  anchorKey: string | null,
  targetKey: string
): string[] {
  const targetIndex = orderedKeys.indexOf(targetKey)
  if (targetIndex < 0) return [targetKey]

  const anchorIndex =
    anchorKey != null ? orderedKeys.indexOf(anchorKey) : -1
  if (anchorIndex < 0) return [targetKey]

  const from = Math.min(anchorIndex, targetIndex)
  const to = Math.max(anchorIndex, targetIndex)
  return orderedKeys.slice(from, to + 1)
}

export function orderedSelectionKeys(
  cards: DeckCardEntry[],
  categories: DeckCategoryOut[],
  sortMode: DeckCardSortMode
): string[] {
  return selectableCardsInOrder(cards, categories, sortMode).map((entry) =>
    deckCardSelectionKey(entry.category_id, entry.card_id)
  )
}
