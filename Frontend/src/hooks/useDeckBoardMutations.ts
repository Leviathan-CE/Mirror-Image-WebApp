/**
 * Board write-path for the deck page: categories, card moves, qty,
 * pilot / objectives reserved slots. Meta (name/tags/like) stays on the page.
 */

import {
  type Dispatch,
  type SetStateAction,
} from "react"

import { DECK_OBJECTIVE_SLOT_COUNT } from "@/components/decks/constants"
import {
  cardsFromDragPayload,
  isLibraryDragPayload,
  type DeckCardDragPayload,
} from "@/components/decks/deckCardDrag"
import {
  objectiveCategory,
  canAddCopyToDeck,
  clampQuantityToMax,
  deckCardCount,
  mainCategoryId,
  maxCopiesForDeckCard,
  maxQuantityForStackEntry,
  nextCardQuantity,
  nextNewSectionName,
  pilotCard,
  pilotCategory,
  applyCardMove,
  removeCardEntry,
  totalCopiesOfCard,
  totalObjectiveCopies,
  isObjectiveCard,
  withCardEntry,
} from "@/components/decks/deck.logic"
import { ApiError } from "@/lib/api/client"
import {
  isPublicTextClean,
  PROFANITY_REJECTED,
  PUBLIC_TEXT_BLOCKED_MESSAGE,
} from "@/lib/profanity"
import { fetchCardById, type CardSearchHit } from "@/lib/api/cards"
import {
  addDeckCard,
  OBJECTIVE_SECTION_NAME,
  createDeckCategory,
  deleteDeckCategory,
  PILOT_SECTION_NAME,
  removeDeckCard,
  updateDeckCard,
  updateDeckCategory,
  type DeckCardEntry,
  type DeckDetail,
} from "@/lib/api/decks"

export type UseDeckBoardMutationsArgs = {
  deck: DeckDetail | null
  setDeck: Dispatch<SetStateAction<DeckDetail | null>>
  token: string | null | undefined
  canEdit: boolean
  saving: boolean
  setSaving: Dispatch<SetStateAction<boolean>>
  setErrorText: Dispatch<SetStateAction<string>>
  loadDeck: (opts?: { silent?: boolean }) => Promise<unknown>
  clearCardSelection: () => void
}

export type UseDeckBoardMutationsResult = {
  onCreateSectionFromDrop: (payload: DeckCardDragPayload) => Promise<void>
  onRenameCategory: (categoryId: number, nextName: string) => Promise<void>
  onSetCategoryInDeck: (categoryId: number, inDeck: boolean) => Promise<void>
  onDeleteCategory: (categoryId: number) => Promise<void>
  onDropCardsToCategory: (
    payload: DeckCardDragPayload,
    toCategoryId: number
  ) => Promise<void>
  onQuantityDelta: (card: DeckCardEntry, delta: 1 | -1) => Promise<void>
  onAddCardFromSearch: (hit: CardSearchHit) => Promise<void>
  onAddCardFromLibrary: (
    cardId: number,
    toCategoryId: number
  ) => Promise<void>
  addObjective: (
    cardId: number,
    fromCategoryId: number | null
  ) => Promise<void>
  assignPilot: (
    cardId: number,
    fromCategoryId: number | null
  ) => Promise<void>
  onClearPilot: () => Promise<void>
}

export function useDeckBoardMutations({
  deck,
  setDeck,
  token,
  canEdit,
  saving,
  setSaving,
  setErrorText,
  loadDeck,
  clearCardSelection,
}: UseDeckBoardMutationsArgs): UseDeckBoardMutationsResult {

  async function onCreateSectionFromDrop(payload: DeckCardDragPayload) {
    if (!token || !deck || !canEdit) return

    const items = cardsFromDragPayload(payload)
    if (items.length === 0) return

    const name = nextNewSectionName(deck.categories.map((c) => c.name))
    const fromLibrary = isLibraryDragPayload(payload)

    setSaving(true)
    setErrorText("")
    try {
      const created = await createDeckCategory(deck.id, token, name)
      setDeck((prev) =>
        prev
          ? { ...prev, categories: [...prev.categories, created] }
          : prev
      )

      let workingCards = deck.cards
      for (const item of items) {
        if (fromLibrary) {
          const entry = await addDeckCard(deck.id, token, {
            card_id: item.cardId,
            category_id: created.id,
            quantity: 1,
          })
          workingCards = withCardEntry(
            { ...deck, cards: workingCards, categories: [...deck.categories, created] },
            entry
          ).cards
          continue
        }
        if (item.fromCategoryId === created.id) continue
        workingCards = await moveStackBetweenCategories(
          workingCards,
          item.cardId,
          item.fromCategoryId,
          created.id
        )
      }

      setDeck((prev) => {
        if (!prev) return prev
        const categories = prev.categories.some((c) => c.id === created.id)
          ? prev.categories
          : [...prev.categories, created]
        return {
          ...prev,
          categories,
          cards: workingCards,
          card_count: deckCardCount(workingCards, categories),
        }
      })
      clearCardSelection()
    } catch {
      setErrorText("Could not create section from that card.")
      await loadDeck()
    } finally {
      setSaving(false)
    }
  }

  async function onRenameCategory(categoryId: number, nextName: string) {
    if (!token || !deck || !canEdit) return
    const name = nextName.trim()
    if (!name) return
    if (!isPublicTextClean(name)) {
      setErrorText(PUBLIC_TEXT_BLOCKED_MESSAGE)
      throw new Error("profanity_rejected")
    }
    setSaving(true)
    setErrorText("")
    try {
      const updated = await updateDeckCategory(deck.id, categoryId, token, {
        name,
      })
      setDeck((prev) =>
        prev
          ? {
            ...prev,
            categories: prev.categories.map((c) =>
              c.id === categoryId ? updated : c
            ),
            cards: prev.cards.map((card) =>
              card.category_id === categoryId
                ? { ...card, category_name: updated.name }
                : card
            ),
          }
          : prev
      )
    } catch (error) {
      setErrorText(
        error instanceof ApiError && error.detail === PROFANITY_REJECTED
          ? PUBLIC_TEXT_BLOCKED_MESSAGE
          : "Could not rename category."
      )
      throw new Error("rename_failed", { cause: error })
    } finally {
      setSaving(false)
    }
  }

  async function onSetCategoryInDeck(categoryId: number, inDeck: boolean) {
    if (!token || !deck || !canEdit) return
    setSaving(true)
    setErrorText("")
    try {
      const updated = await updateDeckCategory(deck.id, categoryId, token, {
        in_deck: inDeck,
      })
      setDeck((prev) => {
        if (!prev) return prev
        const categories = prev.categories.map((c) =>
          c.id === categoryId ? updated : c
        )
        return {
          ...prev,
          categories,
          card_count: deckCardCount(prev.cards, categories),
        }
      })
    } catch {
      setErrorText("Could not update section.")
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteCategory(categoryId: number) {
    if (!token || !deck || !canEdit) return
    setSaving(true)
    setErrorText("")
    try {
      await deleteDeckCategory(deck.id, categoryId, token)
      setDeck((prev) =>
        prev
          ? {
            ...prev,
            categories: prev.categories.filter((c) => c.id !== categoryId),
          }
          : prev
      )
    } catch (error) {
      setErrorText(
        error instanceof ApiError && error.status === 409
          ? "Remove all cards from this section before deleting it."
          : "Could not delete category."
      )
      throw new Error("delete_failed", { cause: error })
    } finally {
      setSaving(false)
    }
  }

  /**
   * Move an entire stack between sections (all copies of that card in the
   * source category). If the destination already has the card, quantities
   * merge up to the section max; leftovers stay in the source.
   */
  async function moveStackBetweenCategories(
    workingCards: DeckCardEntry[],
    cardId: number,
    fromCategoryId: number,
    toCategoryId: number
  ): Promise<DeckCardEntry[]> {
    if (!token || !deck) return workingCards
    if (fromCategoryId === toCategoryId) return workingCards

    const source = workingCards.find(
      (card) =>
        card.card.id === cardId && card.category_id === fromCategoryId
    )
    if (!source) return workingCards

    const destCategory = deck.categories.find((c) => c.id === toCategoryId) ?? {
      id: toCategoryId,
      name: "",
      sort_order: 0,
    }
    const existingDest = workingCards.find(
      (card) =>
        card.card.id === cardId && card.category_id === toCategoryId
    )
    const maxCopies = maxCopiesForDeckCard(destCategory, source)
    const destQty = existingDest?.quantity ?? 0
    if (destQty >= maxCopies) {
      throw new Error("max_copies")
    }

    const moveQty = Math.min(source.quantity, maxCopies - destQty)
    if (moveQty <= 0) throw new Error("max_copies")

    // Empty destination: one PATCH relocates the whole stack (keeps quantity).
    if (!existingDest && moveQty === source.quantity) {
      const moved = await updateDeckCard(
        deck.id,
        cardId,
        fromCategoryId,
        token,
        { category_id: toCategoryId }
      )
      return applyCardMove(workingCards, fromCategoryId, moved)
    }

    // Merge into an existing dest stack (or partial move when capped).
    const mergedQty = destQty + moveQty
    let nextCards = workingCards

    if (existingDest) {
      const updatedDest = await updateDeckCard(
        deck.id,
        cardId,
        toCategoryId,
        token,
        { quantity: mergedQty }
      )
      nextCards = [
        ...removeCardEntry(nextCards, cardId, toCategoryId),
        updatedDest,
      ]
    } else {
      const added = await addDeckCard(deck.id, token, {
        card_id: cardId,
        category_id: toCategoryId,
        quantity: moveQty,
      })
      const clampedQty = clampQuantityToMax(added.quantity, maxCopies)
      const entry =
        clampedQty < added.quantity
          ? await updateDeckCard(deck.id, cardId, toCategoryId, token, {
              quantity: clampedQty,
            })
          : added
      nextCards = withCardEntry({ ...deck, cards: nextCards }, entry).cards
    }

    const remaining = source.quantity - moveQty
    if (remaining <= 0) {
      await removeDeckCard(deck.id, cardId, fromCategoryId, token)
      return removeCardEntry(nextCards, cardId, fromCategoryId)
    }

    const reduced = await updateDeckCard(
      deck.id,
      cardId,
      fromCategoryId,
      token,
      { quantity: remaining }
    )
    return [
      ...removeCardEntry(nextCards, cardId, fromCategoryId),
      reduced,
    ]
  }

  async function onMoveCards(
    items: Array<{ cardId: number; fromCategoryId: number }>,
    toCategoryId: number
  ) {
    if (!token || !deck || !canEdit) return
    const toMove = items.filter((item) => item.fromCategoryId !== toCategoryId)
    if (toMove.length === 0) return

    setSaving(true)
    setErrorText("")
    try {
      let workingCards = deck.cards
      for (const item of toMove) {
        workingCards = await moveStackBetweenCategories(
          workingCards,
          item.cardId,
          item.fromCategoryId,
          toCategoryId
        )
      }
      setDeck((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          cards: workingCards,
          card_count: deckCardCount(workingCards, prev.categories),
        }
      })
      clearCardSelection()
    } catch (error) {
      setErrorText(
        error instanceof Error && error.message === "max_copies"
          ? "That section already has the maximum copies of that card."
          : error instanceof ApiError && error.status === 409
            ? "That card is already in the target section."
            : "Could not move card."
      )
      await loadDeck()
    } finally {
      setSaving(false)
    }
  }

  async function onAddCardFromLibrary(
    cardId: number,
    toCategoryId: number
  ) {
    if (!token || !deck || !canEdit) return

    const category = deck.categories.find((c) => c.id === toCategoryId)
    if (!category) {
      setErrorText("That section no longer exists.")
      return
    }

    const existing = deck.cards.find(
      (card) => card.card.id === cardId && card.category_id === toCategoryId
    )
    const known =
      existing ?? deck.cards.find((card) => card.card.id === cardId)
    let maxCopies = maxCopiesForDeckCard(category, known)
    if (!known) {
      try {
        const detail = await fetchCardById(cardId, token)
        maxCopies = maxCopiesForDeckCard(category, detail)
      } catch {
        // Default to standard 3 until the card is on the board.
      }
    }

    if (existing) {
      const stackMax = maxQuantityForStackEntry(
        deck.cards,
        cardId,
        existing.quantity,
        maxCopies
      )
      const nextQty = nextCardQuantity(existing.quantity, 1, stackMax)
      if (nextQty === null) {
        setErrorText(
          `Deck already has the maximum copies of that card across all sections.`
        )
        return
      }
      setSaving(true)
      setErrorText("")
      try {
        const updated = await updateDeckCard(
          deck.id,
          existing.card.id,
          existing.category_id,
          token,
          { quantity: nextQty }
        )
        setDeck((prev) => (prev ? withCardEntry(prev, updated) : prev))
      } catch {
        setErrorText("Could not add that card.")
        await loadDeck()
      } finally {
        setSaving(false)
      }
      return
    }

    const canAdd = canAddCopyToDeck(
      totalCopiesOfCard(deck.cards, cardId),
      maxCopies
    )
    if (!canAdd.ok) {
      setErrorText(canAdd.message)
      return
    }

    setSaving(true)
    setErrorText("")
    try {
      const entry = await addDeckCard(deck.id, token, {
        card_id: cardId,
        category_id: toCategoryId,
        quantity: 1,
      })
      const clampedQty = clampQuantityToMax(entry.quantity, maxCopies)
      if (clampedQty < entry.quantity) {
        const clamped = await updateDeckCard(
          deck.id,
          entry.card.id,
          entry.category_id,
          token,
          { quantity: clampedQty }
        )
        setDeck((prev) => (prev ? withCardEntry(prev, clamped) : prev))
        return
      }
      setDeck((prev) => (prev ? withCardEntry(prev, entry) : prev))
    } catch {
      setErrorText("Could not add that card.")
      await loadDeck()
    } finally {
      setSaving(false)
    }
  }

  async function onDropCardsToCategory(
    payload: DeckCardDragPayload,
    toCategoryId: number
  ) {
    if (isLibraryDragPayload(payload)) {
      await onAddCardFromLibrary(payload.cardId, toCategoryId)
      return
    }
    await onMoveCards(cardsFromDragPayload(payload), toCategoryId)
  }

  async function onQuantityDelta(card: DeckCardEntry, delta: 1 | -1) {
    if (!token || !deck || !canEdit || saving) return

    const category = deck.categories.find((c) => c.id === card.category_id) ?? {
      id: -1,
      name: "",
      sort_order: 0,
    }
    const maxCopies = maxCopiesForDeckCard(category, card)
    const stackMax =
      delta > 0
        ? maxQuantityForStackEntry(
            deck.cards,
            card.card.id,
            card.quantity,
            maxCopies
          )
        : maxCopies
    const nextQty = nextCardQuantity(card.quantity, delta, stackMax)
    if (nextQty === null) return

    setErrorText("")
    try {
      if (nextQty <= 0) {
        await removeDeckCard(deck.id, card.card.id, card.category_id, token)
        setDeck((prev) => {
          if (!prev) return prev
          const cards = removeCardEntry(
            prev.cards,
            card.card.id,
            card.category_id
          )
          return {
            ...prev,
            cards,
            card_count: deckCardCount(cards, prev.categories),
          }
        })
        return
      }

      const updated = await updateDeckCard(
        deck.id,
        card.card.id,
        card.category_id,
        token,
        { quantity: nextQty }
      )
      setDeck((prev) => {
        if (!prev) return prev
        const cards = prev.cards.map((entry) =>
          entry.card.id === card.card.id &&
            entry.category_id === card.category_id
            ? updated
            : entry
        )
        return {
          ...prev,
          cards,
          card_count: deckCardCount(cards, prev.categories),
        }
      })
    } catch {
      setErrorText(
        delta > 0 ? "Could not add a copy." : "Could not remove a copy."
      )
    }
  }

  async function onAddCardFromSearch(hit: CardSearchHit) {
    if (!token || !deck || !canEdit) return

    setErrorText("")
    try {
      const detail = await fetchCardById(hit.id, token)
      if (detail.is_pilot) {
        await assignPilot(hit.id, null)
        return
      }
      if (isObjectiveCard(detail)) {
        await addObjective(hit.id, null)
        return
      }

      const categoryId = mainCategoryId(deck.categories)
      if (categoryId == null) {
        setErrorText("No in-deck section found on this deck.")
        return
      }

      const category =
        deck.categories.find((c) => c.id === categoryId) ?? {
          id: categoryId,
          name: "",
          sort_order: 0,
        }
      const maxCopies = maxCopiesForDeckCard(category, detail)
      const canAdd = canAddCopyToDeck(
        totalCopiesOfCard(deck.cards, hit.id),
        maxCopies
      )
      if (!canAdd.ok) {
        setErrorText(canAdd.message)
        return
      }

      const entry = await addDeckCard(deck.id, token, {
        card_id: hit.id,
        category_id: categoryId,
        quantity: 1,
      })
      const clampedQty = clampQuantityToMax(entry.quantity, maxCopies)
      if (clampedQty < entry.quantity) {
        const clamped = await updateDeckCard(
          deck.id,
          entry.card.id,
          entry.category_id,
          token,
          { quantity: clampedQty }
        )
        setDeck((prev) => (prev ? withCardEntry(prev, clamped) : prev))
        return
      }
      setDeck((prev) => (prev ? withCardEntry(prev, entry) : prev))
    } catch {
      setErrorText("Could not add that card.")
    }
  }

  async function ensureObjectiveCategoryId(): Promise<number | null> {
    if (!token || !deck) return null
    const existing = objectiveCategory(deck.categories)
    if (existing) {
      // Migrate legacy "Augments" section name to Objectives.
      if (
        existing.name.trim().toLowerCase() !==
        OBJECTIVE_SECTION_NAME.toLowerCase()
      ) {
        try {
          const updated = await updateDeckCategory(
            deck.id,
            existing.id,
            token,
            { name: OBJECTIVE_SECTION_NAME }
          )
          setDeck((prev) =>
            prev
              ? {
                  ...prev,
                  categories: prev.categories.map((c) =>
                    c.id === existing.id ? updated : c
                  ),
                  cards: prev.cards.map((card) =>
                    card.category_id === existing.id
                      ? { ...card, category_name: updated.name }
                      : card
                  ),
                }
              : prev
          )
        } catch {
          /* display name is overridden in DeckBoard regardless */
        }
      }
      return existing.id
    }

    const created = await createDeckCategory(
      deck.id,
      token,
      OBJECTIVE_SECTION_NAME,
      { in_deck: false }
    )
    setDeck((prev) =>
      prev
        ? {
          ...prev,
          categories: [...prev.categories, created],
        }
        : prev
    )
    return created.id
  }

  async function addObjective(
    cardId: number,
    fromCategoryId: number | null
  ) {
    if (!token || !deck || !canEdit) return

    const detail = await fetchCardById(cardId, token)
    if (!isObjectiveCard(detail)) {
      setErrorText("Only cards with the Objective super type can go in Objectives.")
      return
    }

    const objectiveCatId = await ensureObjectiveCategoryId()
    if (objectiveCatId == null) {
      setErrorText("Could not open the Objectives section.")
      return
    }

    const already = deck.cards.find(
      (card) => card.card.id === cardId && card.category_id === objectiveCatId
    )
    if (already) {
      setErrorText("That objective is already in the list.")
      return
    }

    if (
      totalObjectiveCopies(deck.cards, deck.categories) >=
      DECK_OBJECTIVE_SLOT_COUNT
    ) {
      setErrorText(
        `A deck can include exactly ${DECK_OBJECTIVE_SLOT_COUNT} objective cards.`
      )
      return
    }

    setSaving(true)
    setErrorText("")
    try {
      let entry: DeckCardEntry
      if (fromCategoryId != null && fromCategoryId !== objectiveCatId) {
        entry = await updateDeckCard(deck.id, cardId, fromCategoryId, token, {
          category_id: objectiveCatId,
          quantity: 1,
        })
      } else {
        entry = await addDeckCard(deck.id, token, {
          card_id: cardId,
          category_id: objectiveCatId,
          quantity: 1,
        })
      }

      setDeck((prev) => {
        if (!prev) return prev
        const withoutSource =
          fromCategoryId != null
            ? prev.cards.filter(
              (card) =>
                !(
                  card.card.id === cardId &&
                  card.category_id === fromCategoryId
                )
            )
            : prev.cards
        return withCardEntry(
          { ...prev, cards: withoutSource },
          { ...entry, quantity: 1 }
        )
      })
      clearCardSelection()
    } catch {
      setErrorText("Could not add that objective.")
      await loadDeck()
    } finally {
      setSaving(false)
    }
  }

  async function ensurePilotCategoryId(): Promise<number | null> {
    if (!token || !deck) return null
    const existing = pilotCategory(deck.categories)
    if (existing) return existing.id

    const created = await createDeckCategory(
      deck.id,
      token,
      PILOT_SECTION_NAME,
      { in_deck: false }
    )
    setDeck((prev) =>
      prev
        ? {
          ...prev,
          categories: [...prev.categories, created],
        }
        : prev
    )
    return created.id
  }

  async function assignPilot(
    cardId: number,
    fromCategoryId: number | null
  ) {
    if (!token || !deck || !canEdit) return

    const detail = await fetchCardById(cardId, token)
    if (!detail.is_pilot) {
      setErrorText("Only pilot cards can go in the Pilot slot.")
      return
    }

    const pilotCatId = await ensurePilotCategoryId()
    if (pilotCatId == null) {
      setErrorText("Could not open the Pilot slot.")
      return
    }

    const current = pilotCard(deck.cards, deck.categories)
    if (current && current.card.id === cardId && current.category_id === pilotCatId) {
      return
    }

    setSaving(true)
    setErrorText("")
    try {
      if (current) {
        await removeDeckCard(
          deck.id,
          current.card.id,
          current.category_id,
          token
        )
      }

      let entry: DeckCardEntry
      if (fromCategoryId != null && fromCategoryId !== pilotCatId) {
        entry = await updateDeckCard(deck.id, cardId, fromCategoryId, token, {
          category_id: pilotCatId,
          quantity: 1,
        })
      } else {
        entry = await addDeckCard(deck.id, token, {
          card_id: cardId,
          category_id: pilotCatId,
          quantity: 1,
        })
      }

      setDeck((prev) => {
        if (!prev) return prev
        const withoutOldPilot = prev.cards.filter(
          (card) => card.category_id !== pilotCatId
        )
        const withoutSource =
          fromCategoryId != null
            ? withoutOldPilot.filter(
              (card) =>
                !(
                  card.card.id === cardId &&
                  card.category_id === fromCategoryId
                )
            )
            : withoutOldPilot
        return withCardEntry(
          { ...prev, cards: withoutSource },
          { ...entry, quantity: 1 }
        )
      })
      clearCardSelection()
    } catch {
      setErrorText("Could not set that pilot.")
      await loadDeck()
    } finally {
      setSaving(false)
    }
  }

  async function onClearPilot() {
    if (!token || !deck || !canEdit) return
    const current = pilotCard(deck.cards, deck.categories)
    if (!current) return

    setSaving(true)
    setErrorText("")
    try {
      await removeDeckCard(
        deck.id,
        current.card.id,
        current.category_id,
        token
      )
      setDeck((prev) => {
        if (!prev) return prev
        const cards = prev.cards.filter(
          (card) =>
            !(
              card.card.id === current.card.id &&
              card.category_id === current.category_id
            )
        )
        return {
          ...prev,
          cards,
          card_count: deckCardCount(cards, prev.categories),
        }
      })
    } catch {
      setErrorText("Could not clear the pilot.")
    } finally {
      setSaving(false)
    }
  }

  return {
    onCreateSectionFromDrop,
    onRenameCategory,
    onSetCategoryInDeck,
    onDeleteCategory,
    onDropCardsToCategory,
    onQuantityDelta,
    onAddCardFromSearch,
    onAddCardFromLibrary,
    addObjective,
    assignPilot,
    onClearPilot,
  }
}
