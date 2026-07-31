/**
 * Vertical overlapping card stack.
 * Hover scales a card and slides covering cards down to reveal it.
 * Left-click +1 (max 3); Ctrl/Cmd+click multi-select; right-click −1 / remove;
 * middle-hold enlarge; drag to move (drags whole selection).
 */

import { useEffect, useRef, useState } from "react"

import {
  ClassifiedCardFace,
  cardClassification,
} from "@/components/decks/ClassifiedCardFace"
import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import { cardArtUrl, type DeckCardEntry } from "@/lib/api/decks"

import "./DeckCardStack.css"

export const DECK_CARD_DRAG_MIME = "application/x-mi-deck-card"
export const DECK_CARD_MAX_COPIES = 3
/** Sentinel `fromCategoryId` for drags that originate in the card library browser. */
export const LIBRARY_DRAG_CATEGORY_ID = -1

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

type DeckCardStackProps = {
  cards: DeckCardEntry[]
  draggable?: boolean
  disabled?: boolean
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
  draggable = false,
  disabled = false,
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

  return (
    <>
      <ul
        className={`deck-card-stack${
          hoveredIndex != null && hoveredIndex < cards.length - 1
            ? " is-revealing"
            : ""
        }`}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {cards.map((card, index) => {
          const classification = cardClassification(card)
          const classified = classification != null
          const src = classified
            ? null
            : cardArtUrl(card.card_art_path, card.card_art_version)
          const isHovered = hoveredIndex === index
          const isCovering =
            hoveredIndex != null && index > hoveredIndex && !isHovered
          const cardKey = deckCardSelectionKey(card.category_id, card.card_id)
          const isSelected = selectedKeys?.has(cardKey) ?? false
          const isDragging = draggingKeys?.has(cardKey) ?? false
          const canDrag = draggable && !disabled

          return (
            <li
              key={cardKey}
              className={`deck-card-stack__item${isHovered ? " is-hovered" : ""}${
                isCovering ? " is-covering" : ""
              }${isDragging ? " is-dragging" : ""}${
                isSelected ? " is-selected" : ""
              }${canDrag ? " is-draggable" : ""}${
                classified ? " is-classified" : ""
              }`}
              style={{
                // Keep stack order — do not pull hovered cards above covers.
                zIndex: index + 1,
                ["--stack-index" as string]: index,
              }}
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
                  cardId: card.card_id,
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
                if (draggingKeys == null) setHoveredIndex(index)
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
                if (card.quantity >= DECK_CARD_MAX_COPIES) return
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
                  ? `${card.card_name} — TOP SECRET · click to inspect`
                  : classification === "classified"
                    ? `${card.card_name} — CLASSIFIED · click for details / become a member`
                  : canAdjust
                    ? `${card.card_name} ×${card.quantity} — click +1 (max ${DECK_CARD_MAX_COPIES}) · Ctrl/Cmd+click select · Shift+click range · right-click −1 · drag to move · middle-hold enlarge`
                    : `${card.card_name} ×${card.quantity} — middle-click hold to enlarge`
              }
            >
              {classified && classification ? (
                <ClassifiedCardFace
                  name={card.card_name}
                  classification={classification}
                  size="stack"
                />
              ) : src ? (
                <img
                  src={src}
                  alt={card.card_name}
                  className="deck-card-stack__art clip-angled"
                  draggable={false}
                />
              ) : (
                <div className="deck-card-stack__fallback clip-angled">
                  <span>{card.card_name}</span>
                </div>
              )}
              {card.quantity > 0 ? (
                <span className="deck-card-stack__qty">×{card.quantity}</span>
              ) : null}
            </li>
          )
        })}
      </ul>

      {enlarged ? (
        <div className="deck-card-enlarge" role="dialog" aria-label={enlarged.card_name}>
          {cardClassification(enlarged) ? (
            <ClassifiedCardFace
              name={enlarged.card_name}
              classification={cardClassification(enlarged)!}
              size="enlarge"
            />
          ) : cardArtUrl(enlarged.card_art_path, enlarged.card_art_version) ? (
            <img
              src={cardArtUrl(enlarged.card_art_path, enlarged.card_art_version)!}
              alt={enlarged.card_name}
              className="deck-card-enlarge__art clip-angled"
              draggable={false}
            />
          ) : (
            <div className="deck-card-enlarge__fallback clip-angled">{enlarged.card_name}</div>
          )}
          <p className="deck-card-enlarge__caption">
            {enlarged.card_name}
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
        name={inspectCard?.card_name ?? ""}
        artSrc={null}
        classification={
          inspectCard ? cardClassification(inspectCard) : null
        }
        onDismiss={() => setInspectCard(null)}
      />
    </>
  )
}
