/**
 * Vertical overlapping card stack.
 * Hover scales a card and slides covering cards down to reveal it.
 * Left-click +1 (per-card max); Ctrl/Cmd+click multi-select; right-click −1 / remove;
 * middle-hold enlarge; drag to move (drags whole selection).
 */

import { useEffect, useRef, useState } from "react"

import {
  ClassifiedCardFace,
  cardClassification,
} from "@/components/decks/ClassifiedCardFace"
import { DeckCardListRow } from "@/components/decks/DeckCardListRow"
import type { DeckCardViewMode } from "@/components/decks/DeckCardViewControls"
import { CardEnlargeOverlay } from "@/components/Playtester/board/CardLargeOverlay"
import { cardFaceUrl, type DeckCardEntry } from "@/lib/api/decks"

import "./DeckCardStack.css"

import {
  beginDeckCardDrag,
  DECK_CARD_DRAG_MIME,
  deckCardSelectionKey,
  endDeckCardDrag,
  type DeckCardDragItem,
  type DeckCardDragPayload,
} from "@/components/decks/deckCardDrag"
import { maxCopiesForDeckCard } from "@/components/decks/deck.logic"
import type { DeckCategoryOut } from "@/lib/api/decks"


type DeckCardStackProps = {
  cards: DeckCardEntry[]
  /** Section this stack belongs to — used for per-card copy-cap tooltips. */
  category?: DeckCategoryOut
  draggable?: boolean
  disabled?: boolean
  /** Art stacks vs condensed colour rows. */
  viewMode?: DeckCardViewMode
  /** Keys from `deckCardSelectionKey`. */
  selectedKeys?: ReadonlySet<string>
  onSelectCard?: (
    card: DeckCardEntry,
    mode: "toggle" | "range"
  ) => void
  /** Clears selection; optional card becomes the new Shift+click anchor. */
  onClearSelect?: (card?: DeckCardEntry) => void
  /** +1 or −1 when owner clicks / right-clicks a card. */
  onQuantityDelta?: (card: DeckCardEntry, delta: 1 | -1) => void
}

export function DeckCardStack({
  cards,
  category,
  draggable = false,
  disabled = false,
  viewMode = "cards",
  selectedKeys,
  onSelectCard,
  onClearSelect,
  onQuantityDelta,
}: DeckCardStackProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [enlarged, setEnlarged] = useState<DeckCardEntry | null>(null)
  /** Sticky redacted zoom (left-click) — subscribe CTA is usable here. */
  const [inspectCard, setInspectCard] = useState<DeckCardEntry | null>(null)
  const [draggingKeys, setDraggingKeys] = useState<ReadonlySet<string> | null>(
    null
  )
  const pointerDownRef = useRef<{
    cardKey: string
    x: number
    y: number
  } | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (!enlarged) return

    function release() {
      setEnlarged(null)
    }

    window.addEventListener("mouseup", release)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("mouseup", release)
      window.removeEventListener("blur", release)
    }
  }, [enlarged])

  if (cards.length === 0) {
    return (
      <p className="font-mono text-xs text-white/35">No cards in this section.</p>
    )
  }

  const canAdjust = Boolean(onQuantityDelta) && !disabled
  const canSelect = Boolean(onSelectCard) && !disabled
  const isList = viewMode === "list"

  return (
    <>
      <ul
        className={
          isList
            ? "deck-card-list"
            : `deck-card-stack${
                hoveredIndex != null && hoveredIndex < cards.length - 1
                  ? " is-revealing"
                  : ""
              }`
        }
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {cards.map((card, index) => {
          const classification = cardClassification(card)
          const classified = classification != null
          const src = classified
            ? null
            : cardFaceUrl(card.card)
          const isHovered = !isList && hoveredIndex === index
          const isCovering =
            !isList &&
            hoveredIndex != null &&
            index > hoveredIndex &&
            !isHovered
          const cardKey = deckCardSelectionKey(card.category_id, card.card.id)
          const isSelected = selectedKeys?.has(cardKey) ?? false
          const isDragging = draggingKeys?.has(cardKey) ?? false
          const canDrag = draggable && !disabled
          const itemClass = isList ? "deck-card-list__item" : "deck-card-stack__item"

          return (
            <li
              key={cardKey}
              className={`${itemClass}${isHovered ? " is-hovered" : ""}${
                isCovering ? " is-covering" : ""
              }${isDragging ? " is-dragging" : ""}${
                isSelected ? " is-selected" : ""
              }${canDrag ? " is-draggable" : ""}${
                classified ? " is-classified" : ""
              }`}
              style={
                isList
                  ? undefined
                  : {
                      // Keep stack order — do not pull hovered cards above covers.
                      zIndex: index + 1,
                      ["--stack-index" as string]: index,
                    }
              }
              // clip-path on the draggable node breaks HTML5 DnD in Chromium —
              // angled look lives on the art child instead.
              draggable={canDrag}
              onDragStart={(event) => {
                if (!canDrag) {
                  event.preventDefault()
                  return
                }
                suppressClickRef.current = true
                const primary: DeckCardDragItem = {
                  cardId: card.card.id,
                  fromCategoryId: card.category_id,
                }
                let cardsToMove: DeckCardDragItem[] = [primary]
                if (isSelected && selectedKeys && selectedKeys.size > 1) {
                  cardsToMove = [...selectedKeys].map((key) => {
                    const [cat, id] = key.split(":")
                    return {
                      cardId: Number(id),
                      fromCategoryId: Number(cat),
                    }
                  })
                  if (
                    !cardsToMove.some(
                      (item) =>
                        item.cardId === primary.cardId &&
                        item.fromCategoryId === primary.fromCategoryId
                    )
                  ) {
                    cardsToMove = [primary, ...cardsToMove]
                  }
                }
                const payload: DeckCardDragPayload = {
                  ...primary,
                  cards: cardsToMove,
                }
                beginDeckCardDrag(payload)
                const encoded = JSON.stringify(payload)
                event.dataTransfer.setData(DECK_CARD_DRAG_MIME, encoded)
                // text/plain keeps the drag "alive" in Chromium/Safari.
                event.dataTransfer.setData("text/plain", encoded)
                event.dataTransfer.effectAllowed = "move"
                setDraggingKeys(
                  new Set(
                    cardsToMove.map((item) =>
                      deckCardSelectionKey(item.fromCategoryId, item.cardId)
                    )
                  )
                )
                setHoveredIndex(null)
              }}
              onDragEnd={() => {
                endDeckCardDrag()
                setDraggingKeys(null)
                window.setTimeout(() => {
                  suppressClickRef.current = false
                }, 0)
              }}
              onMouseEnter={() => {
                if (!isList && draggingKeys == null) setHoveredIndex(index)
              }}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  setEnlarged(card)
                  return
                }
                if (event.button === 0) {
                  pointerDownRef.current = {
                    cardKey,
                    x: event.clientX,
                    y: event.clientY,
                  }
                }
              }}
              onClick={(event) => {
                if (event.button !== 0) return
                if (suppressClickRef.current || draggingKeys != null) return
                const down = pointerDownRef.current
                pointerDownRef.current = null
                if (!down || down.cardKey !== cardKey) return
                const moved = Math.hypot(
                  event.clientX - down.x,
                  event.clientY - down.y
                )
                if (moved > 6) return

                if (canSelect && event.shiftKey) {
                  event.preventDefault()
                  onSelectCard?.(card, "range")
                  return
                }

                if (canSelect && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  onSelectCard?.(card, "toggle")
                  return
                }

                // Redacted stubs: open sticky zoom so the member CTA is clickable.
                if (classified) {
                  event.preventDefault()
                  onClearSelect?.()
                  setInspectCard(card)
                  return
                }

                onClearSelect?.(card)

                if (!canAdjust) return
                // Parent enforces the deck-wide copy cap (all sections).
                onQuantityDelta?.(card, 1)
              }}
              onContextMenu={(event) => {
                if (!canAdjust) return
                event.preventDefault()
                onQuantityDelta?.(card, -1)
              }}
              onAuxClick={(event) => {
                if (event.button === 1) event.preventDefault()
              }}
              title={
                classification === "top_secret"
                  ? `${card.card.card_name} — TOP SECRET · click to inspect`
                  : classification === "classified"
                    ? `${card.card.card_name} — CLASSIFIED · click for details / become a member`
                  : canAdjust
                    ? `${card.card.card_name} ×${card.quantity} — click +1 (max ${maxCopiesForDeckCard(category ?? { id: 0, name: "Main", sort_order: 0 }, card)}) · Ctrl/Cmd+click select · Shift+click range · right-click −1 · drag to move · middle-hold enlarge`
                    : `${card.card.card_name} ×${card.quantity} — middle-click hold to enlarge`
              }
            >
              {isList ? (
                <DeckCardListRow card={card} classified={classification} />
              ) : (
                <>
                  {classified && classification ? (
                    <ClassifiedCardFace
                      name={card.card.card_name}
                      classification={classification}
                      size="stack"
                    />
                  ) : src ? (
                    <img
                      src={src}
                      alt={card.card.card_name}
                      className="deck-card-stack__art clip-angled"
                      draggable={false}
                    />
                  ) : (
                    <div className="deck-card-stack__fallback clip-angled">
                      <span>{card.card.card_name}</span>
                    </div>
                  )}
                  {card.quantity > 0 ? (
                    <span className="deck-card-stack__qty">×{card.quantity}</span>
                  ) : null}
                </>
              )}
            </li>
          )
        })}
      </ul>

      {enlarged ? (
        <div className="deck-card-enlarge" role="dialog" aria-label={enlarged.card.card_name}>
          {cardClassification(enlarged) ? (
            <ClassifiedCardFace
              name={enlarged.card.card_name}
              classification={cardClassification(enlarged)!}
              size="enlarge"
            />
          ) : cardFaceUrl(enlarged.card) ? (
            <img
              src={cardFaceUrl(enlarged.card)!}
              alt={enlarged.card.card_name}
              className="deck-card-enlarge__art clip-angled"
              draggable={false}
            />
          ) : (
            <div className="deck-card-enlarge__fallback clip-angled">{enlarged.card.card_name}</div>
          )}
          <p className="deck-card-enlarge__caption">
            {enlarged.card.card_name}
            {cardClassification(enlarged) === "top_secret"
              ? " — TOP SECRET"
              : cardClassification(enlarged) === "classified"
                ? " — CLASSIFIED"
                : ""}
            {enlarged.quantity > 1 ? ` ×${enlarged.quantity}` : ""}
          </p>
        </div>
      ) : null}

      <CardEnlargeOverlay
        open={inspectCard != null}
        name={inspectCard?.card.card_name ?? ""}
        artSrc={null}
        classification={
          inspectCard ? cardClassification(inspectCard) : null
        }
        onDismiss={() => setInspectCard(null)}
      />
    </>
  )
}
