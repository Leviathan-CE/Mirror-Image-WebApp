/**
 * Deck view / edit page (`/decks/:deckId`).
 *
 * - Anyone can view a public deck (or an owned private deck when logged in).
 * - Owner can edit name, description, visibility, and categories.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { DeckBoard } from "@/components/decks/DeckBoard"
import { DeckCardSearch } from "@/components/decks/DeckCardSearch"
import {
  DeckCardSortControls,
  type DeckCardSortMode,
} from "@/components/decks/DeckCardSortControls"
import {
  cardsFromDragPayload,
  isLibraryDragPayload,
  type DeckCardDragPayload,
} from "@/components/decks/DeckCardStack"
import { CardLibraryBrowser } from "@/components/cards/CardLibraryBrowser"
import "@/components/decks/DeckCardStack.css"
import {
  augmentCategory,
  canAddCopyToDeck,
  clampQuantityToMax,
  deckCardCount,
  mainCategoryId,
  maxCopiesForCategory,
  maxQuantityForStackEntry,
  nextCardQuantity,
  nextNewSectionName,
  pilotCard,
  pilotCategory,
  applyCardMove,
  removeCardEntry,
  totalCopiesOfCard,
  withCardEntry,
} from "@/components/decks/deck.logic"
import { useCardSelection } from "@/hooks/useCardSelection"
import { useDeckDetail } from "@/hooks/useDeckDetail"
import { DeckTagSuggestInput } from "@/components/decks/DeckTagSuggestInput"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { DropdownMenu } from "@/components/ui/DropdownMenu"
import {
  PublicTextArea,
  PublicTextField,
} from "@/components/ui/PublicTextField"
import { ApiError } from "@/lib/api/client"
import {
  isPublicTextClean,
  PROFANITY_REJECTED,
  PUBLIC_TEXT_BLOCKED_MESSAGE,
} from "@/lib/profanity"
import { fetchCardById, type CardSearchHit } from "@/lib/api/cards"
import {
  addDeckCard,
  addDeckTag,
  AUGMENT_SECTION_NAME,
  copyDeck,
  createDeckCategory,
  deleteDeck,
  deleteDeckCategory,
  deckCoverUrl,
  likeDeck,
  PILOT_SECTION_NAME,
  removeDeckCard,
  removeDeckTag,
  unlikeDeck,
  updateDeck,
  updateDeckCard,
  updateDeckCategory,
  type DeckCardEntry,
} from "@/lib/api/decks"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

const BROWSE_WIDTH_STORAGE_KEY = "mi-deck-browse-width-px"
const BROWSE_WIDTH_MIN = 280
/** Leave this much horizontal room for the deck board while resizing. */
const BROWSE_WIDTH_DECK_REMAIN_MIN = 280
const BROWSE_WIDTH_DEFAULT = 352

/** Widest the library panel may grow — viewport minus a thin deck strip. */
function maxBrowseWidth(): number {
  if (typeof window === "undefined") return BROWSE_WIDTH_MIN
  return Math.max(
    BROWSE_WIDTH_MIN,
    window.innerWidth - BROWSE_WIDTH_DECK_REMAIN_MIN
  )
}

function clampBrowseWidth(width: number): number {
  return Math.min(
    maxBrowseWidth(),
    Math.max(BROWSE_WIDTH_MIN, Math.round(width))
  )
}

function readStoredBrowseWidth(): number {
  try {
    const raw = window.localStorage.getItem(BROWSE_WIDTH_STORAGE_KEY)
    const parsed = raw == null ? NaN : Number(raw)
    return Number.isFinite(parsed)
      ? clampBrowseWidth(parsed)
      : BROWSE_WIDTH_DEFAULT
  } catch {
    return BROWSE_WIDTH_DEFAULT
  }
}

export function DeckPage() {
  const { deckId: deckIdParam } = useParams()
  const deckId = Number(deckIdParam)
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()

  const {
    deck,
    setDeck,
    status,
    errorText,
    setErrorText,
    loadDeck: reloadDeck,
  } = useDeckDetail(deckId, token)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [searchMenuOpen, setSearchMenuOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(true)
  const [browseWidth, setBrowseWidth] = useState(BROWSE_WIDTH_DEFAULT)
  const [cardSortMode, setCardSortMode] = useState<DeckCardSortMode>("type")
  const [tagDraft, setTagDraft] = useState("")
  const browseResizeRef = useRef<{
    pointerId: number
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    setBrowseWidth(readStoredBrowseWidth())
  }, [])

  // If the window shrinks, pull the panel back so it still leaves room for the board.
  useEffect(() => {
    function onWindowResize() {
      setBrowseWidth((w) => clampBrowseWidth(w))
    }
    window.addEventListener("resize", onWindowResize)
    return () => window.removeEventListener("resize", onWindowResize)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BROWSE_WIDTH_STORAGE_KEY,
        String(browseWidth)
      )
    } catch {
      /* private mode / quota */
    }
  }, [browseWidth])

  function onBrowseResizePointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    browseResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: browseWidth,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onBrowseResizePointerMove(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag = browseResizeRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    // Panel is on the right — drag handle leftward = wider.
    setBrowseWidth(
      clampBrowseWidth(drag.startWidth - (event.clientX - drag.startX))
    )
  }

  function onBrowseResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = browseResizeRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    browseResizeRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  const canEdit =
    Boolean(deck && user && deck.author_name === user.user_name && token)

  async function onCopyDeck() {
    if (!token || !deck || saving) return
    setSaving(true)
    setErrorText("")
    try {
      const copied = await copyDeck(deck.id, token)
      navigate(ROUTES.deck(copied.id), { replace: false })
    } catch {
      setErrorText("Could not copy this deck.")
    } finally {
      setSaving(false)
    }
  }

  async function onToggleLike() {
    if (!token || !deck || saving) return
    setSaving(true)
    setErrorText("")
    try {
      const summary = deck.liked_by_me
        ? await unlikeDeck(deck.id, token)
        : await likeDeck(deck.id, token)
      setDeck((prev) =>
        prev
          ? {
              ...prev,
              like_count: summary.like_count,
              liked_by_me: summary.liked_by_me,
              view_count: summary.view_count,
              tags: summary.tags,
            }
          : prev
      )
    } catch {
      setErrorText("Could not update like.")
    } finally {
      setSaving(false)
    }
  }

  async function onAddTag(rawTag?: string) {
    if (!token || !deck || !canEdit || saving) return
    const next = (rawTag ?? tagDraft).trim()
    if (!next) return
    if (!isPublicTextClean(next)) {
      setErrorText(PUBLIC_TEXT_BLOCKED_MESSAGE)
      return
    }
    setSaving(true)
    setErrorText("")
    try {
      const summary = await addDeckTag(deck.id, token, next)
      setDeck((prev) =>
        prev
          ? {
              ...prev,
              tags: summary.tags,
              like_count: summary.like_count,
              view_count: summary.view_count,
            }
          : prev
      )
      setTagDraft("")
    } catch (error) {
      setErrorText(
        error instanceof ApiError && error.detail === "invalid_tag"
          ? "Tags: 1–32 chars, letters/numbers/spaces/-/_."
          : error instanceof ApiError && error.detail === PROFANITY_REJECTED
            ? PUBLIC_TEXT_BLOCKED_MESSAGE
            : "Could not add tag."
      )
    } finally {
      setSaving(false)
    }
  }

  async function onRemoveTag(tag: string) {
    if (!token || !deck || !canEdit || saving) return
    setSaving(true)
    setErrorText("")
    try {
      const summary = await removeDeckTag(deck.id, token, tag)
      setDeck((prev) =>
        prev
          ? {
              ...prev,
              tags: summary.tags,
              like_count: summary.like_count,
              view_count: summary.view_count,
            }
          : prev
      )
    } catch {
      setErrorText("Could not remove tag.")
    } finally {
      setSaving(false)
    }
  }

  const { selectedKeys, selectCard, clearCardSelection } = useCardSelection({
    deck,
    sortMode: cardSortMode,
    enabled: canEdit,
  })

  const loadDeck = useCallback(
    async (opts?: { silent?: boolean }) => {
      const detail = await reloadDeck(opts)
      if (detail) {
        setName(detail.name ?? "")
        setDescription(detail.description ?? "")
        setIsPublic(detail.is_public)
      }
    },
    [reloadDeck]
  )

  // Keep edit-form fields aligned when the shared hook loads/reloads this deck.
  useEffect(() => {
    if (status !== "ready" || !deck) return
    setName(deck.name ?? "")
    setDescription(deck.description ?? "")
    setIsPublic(deck.is_public)
  }, [status, deck?.id])


  // After re-uploading art elsewhere, refresh timestamps so ?v= updates.
  useEffect(() => {
    function onReturn() {
      if (document.visibilityState !== "visible") return
      void loadDeck({ silent: true })
    }
    document.addEventListener("visibilitychange", onReturn)
    window.addEventListener("focus", onReturn)
    return () => {
      document.removeEventListener("visibilitychange", onReturn)
      window.removeEventListener("focus", onReturn)
    }
  }, [loadDeck])

  async function onSaveMeta() {
    if (!token || !deck || !canEdit) return
    if (!isPublicTextClean(name, description)) {
      setErrorText(PUBLIC_TEXT_BLOCKED_MESSAGE)
      return
    }
    setSaving(true)
    setErrorText("")
    try {
      const updated = await updateDeck(deck.id, token, {
        name: name.trim() || "Untitled Deck",
        description: description.trim() || null,
        is_public: isPublic,
      })
      setDeck((prev) =>
        prev
          ? {
            ...prev,
            ...updated,
            categories: prev.categories,
            cards: prev.cards,
          }
          : prev
      )
      setEditing(false)
    } catch (error) {
      setErrorText(
        error instanceof ApiError && error.detail === PROFANITY_REJECTED
          ? PUBLIC_TEXT_BLOCKED_MESSAGE
          : error instanceof ApiError
            ? "Could not save deck details."
            : "Save failed."
      )
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteDeck() {
    if (!token || !deck || !canEdit) return
    setSaving(true)
    setErrorText("")
    try {
      await deleteDeck(deck.id, token)
      setDeleteOpen(false)
      navigate(ROUTES.MAIN)
    } catch (error) {
      setErrorText(
        error instanceof ApiError
          ? "Could not delete this deck."
          : "Delete failed."
      )
    } finally {
      setSaving(false)
    }
  }

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
        return {
          ...prev,
          categories: prev.categories.some((c) => c.id === created.id)
            ? prev.categories
            : [...prev.categories, created],
          cards: workingCards,
          card_count: deckCardCount(workingCards),
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
      throw new Error("rename_failed")
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
      throw new Error("delete_failed")
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
        card.card_id === cardId && card.category_id === fromCategoryId
    )
    if (!source) return workingCards

    const destCategory = deck.categories.find((c) => c.id === toCategoryId) ?? {
      id: toCategoryId,
      name: "",
      sort_order: 0,
    }
    const maxCopies = maxCopiesForCategory(destCategory)
    const existingDest = workingCards.find(
      (card) =>
        card.card_id === cardId && card.category_id === toCategoryId
    )
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
          card_count: deckCardCount(workingCards),
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

    const maxCopies = maxCopiesForCategory(category)
    const existing = deck.cards.find(
      (card) => card.card_id === cardId && card.category_id === toCategoryId
    )

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
          existing.card_id,
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
          entry.card_id,
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
    const maxCopies = maxCopiesForCategory(category)
    const stackMax =
      delta > 0
        ? maxQuantityForStackEntry(
            deck.cards,
            card.card_id,
            card.quantity,
            maxCopies
          )
        : maxCopies
    const nextQty = nextCardQuantity(card.quantity, delta, stackMax)
    if (nextQty === null) return

    setErrorText("")
    try {
      if (nextQty <= 0) {
        await removeDeckCard(deck.id, card.card_id, card.category_id, token)
        setDeck((prev) => {
          if (!prev) return prev
          const cards = removeCardEntry(
            prev.cards,
            card.card_id,
            card.category_id
          )
          return {
            ...prev,
            cards,
            card_count: deckCardCount(cards),
          }
        })
        return
      }

      const updated = await updateDeckCard(
        deck.id,
        card.card_id,
        card.category_id,
        token,
        { quantity: nextQty }
      )
      setDeck((prev) => {
        if (!prev) return prev
        const cards = prev.cards.map((entry) =>
          entry.card_id === card.card_id &&
            entry.category_id === card.category_id
            ? updated
            : entry
        )
        return {
          ...prev,
          cards,
          card_count: deckCardCount(cards),
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
      if (detail.is_augment) {
        await addAugment(hit.id, null)
        return
      }

      const categoryId = mainCategoryId(deck.categories)
      if (categoryId == null) {
        setErrorText("No Main section found on this deck.")
        return
      }

      const canAdd = canAddCopyToDeck(totalCopiesOfCard(deck.cards, hit.id))
      if (!canAdd.ok) {
        setErrorText(canAdd.message)
        return
      }

      const entry = await addDeckCard(deck.id, token, {
        card_id: hit.id,
        category_id: categoryId,
        quantity: 1,
      })
      const clampedQty = clampQuantityToMax(entry.quantity)
      if (clampedQty < entry.quantity) {
        const clamped = await updateDeckCard(
          deck.id,
          entry.card_id,
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

  async function ensureAugmentCategoryId(): Promise<number | null> {
    if (!token || !deck) return null
    const existing = augmentCategory(deck.categories)
    if (existing) return existing.id

    const created = await createDeckCategory(
      deck.id,
      token,
      AUGMENT_SECTION_NAME
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

  async function addAugment(
    cardId: number,
    fromCategoryId: number | null
  ) {
    if (!token || !deck || !canEdit) return

    const detail = await fetchCardById(cardId, token)
    if (!detail.is_augment) {
      setErrorText("Only augment cards can go in Augments.")
      return
    }

    const augmentCatId = await ensureAugmentCategoryId()
    if (augmentCatId == null) {
      setErrorText("Could not open the Augments section.")
      return
    }

    const already = deck.cards.find(
      (card) => card.card_id === cardId && card.category_id === augmentCatId
    )
    if (already) {
      setErrorText("That augment is already in the list.")
      return
    }

    setSaving(true)
    setErrorText("")
    try {
      let entry: DeckCardEntry
      if (fromCategoryId != null && fromCategoryId !== augmentCatId) {
        entry = await updateDeckCard(deck.id, cardId, fromCategoryId, token, {
          category_id: augmentCatId,
          quantity: 1,
        })
      } else {
        entry = await addDeckCard(deck.id, token, {
          card_id: cardId,
          category_id: augmentCatId,
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
                  card.card_id === cardId &&
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
      setErrorText("Could not add that augment.")
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
      PILOT_SECTION_NAME
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
    if (current && current.card_id === cardId && current.category_id === pilotCatId) {
      return
    }

    setSaving(true)
    setErrorText("")
    try {
      if (current) {
        await removeDeckCard(
          deck.id,
          current.card_id,
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
                  card.card_id === cardId &&
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
        current.card_id,
        current.category_id,
        token
      )
      setDeck((prev) => {
        if (!prev) return prev
        const cards = prev.cards.filter(
          (card) =>
            !(
              card.card_id === current.card_id &&
              card.category_id === current.category_id
            )
        )
        return {
          ...prev,
          cards,
          card_count: cards.reduce((sum, card) => sum + card.quantity, 0),
        }
      })
    } catch {
      setErrorText("Could not clear the pilot.")
    } finally {
      setSaving(false)
    }
  }

  const cover = deckCoverUrl(deck?.cover_image_path)

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-none pt-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <GlitchFx
            type="button"
            label="← BACK"
            className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900"
            onClick={() => {
               navigate(ROUTES.DECK_COMUNITY)
            }}
          />
          {canEdit ? (
            <span className="font-mono text-[10px] tracking-wide text-cyan-400/70">
              {editing ? "EDIT MODE" : "OWNER VIEW"}
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-wide text-white/40">
              READ ONLY
            </span>
          )}
        </div>

        {status === "loading" && (
          <p className="font-mono text-sm text-cyan-300/70">Loading deck…</p>
        )}

        {status === "error" && (
          <div className="border border-red-500/30 bg-black/50 p-6">
            <p className="text-sm text-red-400" role="alert">
              {errorText}
            </p>
            {!isAuthenticated ? (
              <Link to={ROUTES.LOGIN} className="mt-4 inline-block">
                <GlitchFx
                  type="button"
                  label="LOGIN"
                  className="font-buahs93 h-9 rounded-none bg-cyan-700 px-6 hover:bg-cyan-900"
                />
              </Link>
            ) : null}
          </div>
        )}

        {status === "ready" && deck ? (
          <>
            <header className="mb-8 border-b border-cyan-500/20 pb-6">
              <div className="flex flex-wrap items-start gap-6">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="h-28 w-28 shrink-0 border border-cyan-500/30 object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center border border-dashed border-cyan-500/25 bg-black/40 font-mono text-[10px] text-cyan-500/50">
                    NO COVER
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {editing && canEdit ? (
                    <div className="flex flex-col gap-3">
                      <PublicTextField
                        value={name}
                        onChange={setName}
                        placeholder="deck name"
                        disabled={saving}
                      />
                      <PublicTextArea
                        value={description}
                        onChange={setDescription}
                        placeholder="description"
                        disabled={saving}
                        rows={3}
                      />
                      <label className="flex items-center gap-2 font-buahs93 text-sm text-cyan-200/80">
                        <input
                          type="checkbox"
                          checked={isPublic}
                          onChange={(e) => setIsPublic(e.target.checked)}
                          disabled={saving}
                          className="accent-cyan-400"
                        />
                        PUBLIC
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <GlitchFx
                          type="button"
                          label={saving ? "SAVING…" : "SAVE"}
                          disabled={
                            saving || !isPublicTextClean(name, description)
                          }
                          className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                          onClick={() => void onSaveMeta()}
                        />
                        <GlitchFx
                          type="button"
                          label="CANCEL"
                          disabled={saving}
                          className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-5 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
                          onClick={() => {
                            setEditing(false)
                            setName(deck.name ?? "")
                            setDescription(deck.description ?? "")
                            setIsPublic(deck.is_public)
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <h1 className="font-glitch text-3xl text-cyan-300 sm:text-4xl">
                            {deck.name ?? `Deck #${deck.id}`}
                          </h1>
                          {canEdit ? (
                            <DropdownMenu
                              label="Deck options"
                              disabled={saving}
                              className="shrink-0"
                              items={[
                                {
                                  id: "edit-details",
                                  label: "Edit details",
                                  onSelect: () => setEditing(true),
                                },
                                {
                                  id: "delete-deck",
                                  label: "Delete deck",
                                  tone: "danger",
                                  onSelect: () => setDeleteOpen(true),
                                },
                              ]}
                            />
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] tracking-wide",
                            deck.is_public
                              ? "text-emerald-400/90"
                              : "text-white/40"
                          )}
                        >
                          {deck.is_public ? "PUBLIC" : "PRIVATE"}
                        </span>
                      </div>
                     
                      <p className="mt-2 font-buahs93 text-sm text-cyan-200/70">
                        by {deck.author_name}
                      </p>
                      {deck.description ? (
                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
                          {deck.description}
                        </p>
                      ) : null}
                      <p className="mt-3 font-mono text-xs text-cyan-300/60">
                        {deck.card_count} cards · {deck.categories.length}{" "}
                        sections · {deck.like_count ?? 0} likes ·{" "}
                        {deck.view_count ?? 0} views
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {(deck.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100"
                          >
                            {tag}
                            {canEdit ? (
                              <button
                                type="button"
                                className="text-cyan-300/70 hover:text-red-300"
                                disabled={saving}
                                aria-label={`Remove tag ${tag}`}
                                onClick={() => void onRemoveTag(tag)}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>

                      {canEdit ? (
                        <div className="mt-3 flex max-w-lg items-center gap-2">
                          <DeckTagSuggestInput
                            value={tagDraft}
                            onChange={setTagDraft}
                            exclude={deck.tags ?? []}
                            disabled={saving}
                            onPick={(tag) => void onAddTag(tag)}
                          />
                          <GlitchFx
                            type="button"
                            label="ADD TAG"
                            disabled={
                              saving ||
                              !tagDraft.trim() ||
                              !isPublicTextClean(tagDraft)
                            }
                            className="font-buahs93 h-8 shrink-0 rounded-none border border-cyan-500/40 bg-black/70 px-4 text-xs text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
                            onClick={() => void onAddTag()}
                          />
                        </div>
                      ) : null}
                    </>
                  )}

                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {isAuthenticated && token ? (
                  <GlitchFx
                    type="button"
                    label={saving ? "COPYING…" : "COPY TO MY DECKS"}
                    disabled={saving}
                    className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-4 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10 disabled:opacity-60"
                    onClick={() => void onCopyDeck()}
                  />
                ) : null}
                {isAuthenticated && token ? (
                  <GlitchFx
                    type="button"
                    label={
                      deck.liked_by_me
                        ? `LIKED (${deck.like_count ?? 0})`
                        : `LIKE (${deck.like_count ?? 0})`
                    }
                    disabled={saving}
                    className={cn(
                      "font-buahs93 h-9 rounded-none px-4",
                      deck.liked_by_me
                        ? "bg-cyan-600 hover:bg-cyan-800"
                        : "border border-cyan-500/40 bg-black/70 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10"
                    )}
                    onClick={() => void onToggleLike()}
                  />
                ) : null}
                {canEdit ? (
                  <>
                    <GlitchFx
                      type="button"
                      label={browseOpen ? "HIDE BROWSE" : "BROWSE"}
                      className="font-buahs93 h-9 rounded-none border border-cyan-500/40 bg-black/70 px-4 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10"
                      onClick={() => setBrowseOpen((prev) => !prev)}
                    />
                  </>
                ) : null}
                <GlitchFx
                  type="button"
                  label="PLAY TEST"
                  className="font-buahs93 h-9 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900"
                  onClick={() => navigate(ROUTES.playTester(deckId))}
                />
              </div>
            </header>

            {errorText && status === "ready" ? (
              <p className="mb-4 text-sm text-red-400" role="alert">
                {errorText}
              </p>
            ) : null}

            <div
              className={cn(
                "flex flex-col gap-6",
                canEdit && browseOpen && "xl:flex-row xl:items-start"
              )}
            >
              <div className="min-w-0 flex-1">
                {canEdit ? (
                  <div className="mb-4">
                    <DeckCardSearch
                      disabled={saving}
                      token={token}
                      onPick={onAddCardFromSearch}
                      onOpenChange={setSearchMenuOpen}
                    />
                  </div>
                ) : null}

                <div className="mb-6">
                  <DeckCardSortControls
                    value={cardSortMode}
                    onChange={setCardSortMode}
                  />
                </div>

                <DeckBoard
                  deck={deck}
                  sortMode={cardSortMode}
                  canEdit={canEdit}
                  disabled={saving}
                  interactionLocked={searchMenuOpen}
                  selectedKeys={selectedKeys}
                  onSelectCard={selectCard}
                  onClearSelect={clearCardSelection}
                  onRenameCategory={onRenameCategory}
                  onDeleteCategory={onDeleteCategory}
                  onDropToCategory={onDropCardsToCategory}
                  onQuantityDelta={onQuantityDelta}
                  onAssignPilot={assignPilot}
                  onClearPilot={canEdit ? onClearPilot : undefined}
                  onAddAugment={addAugment}
                  onCreateSectionFromDrop={onCreateSectionFromDrop}
                />
              </div>

              {canEdit && browseOpen ? (
                <aside
                  className="relative flex w-full shrink-0 flex-col overflow-visible border border-cyan-500/25 bg-black/55 p-3 xl:w-[var(--browse-w)]"
                  style={{ ["--browse-w" as string]: `${browseWidth}px` }}
                >
                  <CardLibraryBrowser
                    className="min-h-0 w-full flex-1"
                    token={token}
                    compact
                    draggable
                    title="CARD LIBRARY"
                    onCardActivate={(card) =>
                      void onAddCardFromSearch({
                        id: card.id,
                        card_name: card.card_name,
                        card_set_name: card.card_set_name,
                        rarity: card.rarity,
                        card_art_path: card.card_art_path,
                        card_art_version: card.card_art_version,
                      })
                    }
                  />
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize card library"
                    title="Drag to resize · double-click to reset"
                    className="absolute top-0 left-0 z-20 hidden h-full w-2 cursor-col-resize touch-none xl:block"
                    onPointerDown={onBrowseResizePointerDown}
                    onPointerMove={onBrowseResizePointerMove}
                    onPointerUp={onBrowseResizePointerUp}
                    onPointerCancel={onBrowseResizePointerUp}
                    onDoubleClick={() => setBrowseWidth(BROWSE_WIDTH_DEFAULT)}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-3 left-0.5 w-0.5 bg-cyan-400/35"
                    />
                  </div>
                </aside>
              ) : null}
            </div>

            <ConfirmDialog
              open={deleteOpen}
              title="Delete deck?"
              description={`Delete “${deck.name ?? `Deck #${deck.id}`}”? This cannot be undone.`}
              confirmLabel="Delete deck"
              cancelLabel="Keep deck"
              tone="danger"
              busy={saving}
              onCancel={() => {
                if (!saving) setDeleteOpen(false)
              }}
              onConfirm={() => {
                void onDeleteDeck()
              }}
            />
          </>
        ) : null}
      </div>
    </section>
  )
}
