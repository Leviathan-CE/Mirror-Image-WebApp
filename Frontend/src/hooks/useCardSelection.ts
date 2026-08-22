/**
 * Multi-select state for deck / playtester card boards.
 *
 * Keys are `${categoryId}:${cardId}` (see deckCardSelectionKey).
 */

import { useCallback, useEffect, useRef, useState } from "react"

import {
  deckCardSelectionKey,
} from "@/components/decks/deckCardDrag"
import type { DeckCardSortMode } from "@/components/decks/DeckCardSortControls"
import {
  orderedSelectionKeys,
  selectionRangeKeys,
  toggleSelectionKey,
} from "@/components/decks/deck.logic"
import type { DeckCardEntry, DeckDetail } from "@/lib/api/decks"

export type UseCardSelectionOptions = {
  deck: DeckDetail | null
  sortMode: DeckCardSortMode
  /** When false, selection clears and Escape is not bound (e.g. read-only deck). */
  enabled?: boolean
}

export type UseCardSelectionResult = {
  selectedKeys: ReadonlySet<string>
  selectCard: (card: DeckCardEntry, mode: "toggle" | "range") => void
  clearCardSelection: (card?: DeckCardEntry) => void
}

export function useCardSelection({
  deck,
  sortMode,
  enabled = true,
}: UseCardSelectionOptions): UseCardSelectionResult {
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const selectionAnchorKeyRef = useRef<string | null>(null)

  const clearCardSelection = useCallback((card?: DeckCardEntry) => {
    setSelectedKeys(new Set())
    if (card) {
      selectionAnchorKeyRef.current = deckCardSelectionKey(
        card.category_id,
        card.card_id
      )
    }
  }, [])

  const selectCard = useCallback(
    (card: DeckCardEntry, mode: "toggle" | "range") => {
      const key = deckCardSelectionKey(card.category_id, card.card_id)

      if (mode === "toggle") {
        selectionAnchorKeyRef.current = key
        setSelectedKeys((prev) => toggleSelectionKey(prev, key))
        return
      }

      if (!deck) {
        selectionAnchorKeyRef.current = key
        setSelectedKeys(new Set([key]))
        return
      }

      const orderedKeys = orderedSelectionKeys(
        deck.cards,
        deck.categories,
        sortMode
      )
      const anchorKey = selectionAnchorKeyRef.current
      const targetIndex = orderedKeys.indexOf(key)
      const anchorIndex =
        anchorKey != null ? orderedKeys.indexOf(anchorKey) : -1

      if (targetIndex < 0 || anchorIndex < 0) {
        selectionAnchorKeyRef.current = key
      }
      setSelectedKeys(new Set(selectionRangeKeys(orderedKeys, anchorKey, key)))
    },
    [deck, sortMode]
  )

  useEffect(() => {
    if (!enabled) {
      clearCardSelection()
      selectionAnchorKeyRef.current = null
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") clearCardSelection()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, clearCardSelection])

  return { selectedKeys, selectCard, clearCardSelection }
}
