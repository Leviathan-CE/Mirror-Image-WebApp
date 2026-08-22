/**
 * Deck-builder HTML5 drag payload helpers.
 * Limits / MIME live in `./constants`.
 */

import {
  DECK_CARD_DRAG_MIME,
  LIBRARY_DRAG_CATEGORY_ID,
} from "@/components/decks/constants"

export {
  DECK_CARD_DRAG_MIME,
  DECK_CARD_MAX_COPIES,
  LIBRARY_DRAG_CATEGORY_ID,
} from "@/components/decks/constants"

export type DeckCardDragItem = {
  cardId: number
  fromCategoryId: number
}

export type DeckCardDragPayload = DeckCardDragItem & {
  /** Full set when dragging a multi-selection (includes the primary item). */
  cards?: DeckCardDragItem[]
}

/** Set during an in-app card drag (types are unreliable mid-drag in some browsers). */
let activeDeckCardDrag: DeckCardDragPayload | null = null

export function getActiveDeckCardDrag(): DeckCardDragPayload | null {
  return activeDeckCardDrag
}

export function beginDeckCardDrag(payload: DeckCardDragPayload): void {
  activeDeckCardDrag = payload
}

export function endDeckCardDrag(): void {
  activeDeckCardDrag = null
}

export function isLibraryDragPayload(payload: DeckCardDragPayload): boolean {
  return payload.fromCategoryId === LIBRARY_DRAG_CATEGORY_ID
}

/** Cursor hint while hovering a drop zone (library = copy, deck = move). */
export function deckCardDropEffect(): "copy" | "move" {
  const active = getActiveDeckCardDrag()
  if (active && isLibraryDragPayload(active)) return "copy"
  return "move"
}

export function deckCardSelectionKey(
  categoryId: number,
  cardId: number
): string {
  return `${categoryId}:${cardId}`
}

export function cardsFromDragPayload(
  payload: DeckCardDragPayload
): DeckCardDragItem[] {
  if (payload.cards && payload.cards.length > 0) return payload.cards
  return [
    { cardId: payload.cardId, fromCategoryId: payload.fromCategoryId },
  ]
}

function parsePayloadJson(raw: string): DeckCardDragPayload | null {
  try {
    const data = JSON.parse(raw) as DeckCardDragPayload
    if (
      typeof data.cardId === "number" &&
      typeof data.fromCategoryId === "number"
    ) {
      if (Array.isArray(data.cards)) {
        const cards = data.cards.filter(
          (item): item is DeckCardDragItem =>
            typeof item?.cardId === "number" &&
            typeof item?.fromCategoryId === "number"
        )
        return cards.length > 0 ? { ...data, cards } : data
      }
      return data
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Read drag payload from the drop event (or the in-memory fallback). */
export function parseDeckCardDrag(event: {
  dataTransfer: DataTransfer
}): DeckCardDragPayload | null {
  const fromMime = event.dataTransfer.getData(DECK_CARD_DRAG_MIME)
  if (fromMime) {
    const parsed = parsePayloadJson(fromMime)
    if (parsed) return parsed
  }
  const fromText = event.dataTransfer.getData("text/plain")
  if (fromText) {
    const parsed = parsePayloadJson(fromText)
    if (parsed) return parsed
  }
  return getActiveDeckCardDrag()
}

/** True while an in-app card drag is over a drop target. */
export function isDeckCardDrag(event: {
  dataTransfer: DataTransfer
}): boolean {
  if (getActiveDeckCardDrag()) return true
  return [...event.dataTransfer.types].includes(DECK_CARD_DRAG_MIME)
}

