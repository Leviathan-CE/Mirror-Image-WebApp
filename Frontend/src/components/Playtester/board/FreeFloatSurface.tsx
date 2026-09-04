/**
 * Free-float play surface — drag cards by {x,y}; ghost escapes overflow to reach hand.
 * Empty-surface drag draws a marquee to multi-select cards.
 * Ctrl/Cmd+click toggles a card in or out of the selection.
 * Dragging a selected card moves / rezones the whole selection as a group.
 *
 * Pointer listeners for marquee + card drag are attached synchronously on
 * pointerdown (not in useEffect) so a quick click cannot miss pointerup.
 * Card drag uses window capture-phase listeners + setPointerCapture so macOS
 * Safari keeps tracking after the pointer leaves the surface.
 *
 * Drag ghosts portal to `document.body` so they escape the board's CSS
 * `transform: scale(boardScale)`. Sample painted/logical scale in pointer
 * handlers and store it on the drag state — do not read refs during render.
 */

import {
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import { LOCAL_SEAT, type PlayerSlot } from "@/components/Playtester/constants"
import {
  cardIsPaintSelected,
  selectionRingClass,
} from "@/components/Playtester/board/selectionChrome"
import { scalePlayPile } from "@/components/Playtester/board/playPileScale.logic"
import {
  PLAY_FLOAT_LOGICAL,
  clientToLogicalField,
  logicalFieldPaintScale,
} from "@/components/Playtester/board/playFieldScale.logic"
import { PlayingCard } from "@/components/Playtester/board/PlayingCard"
import {
  type CardCounterKind,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import { useLatestRef } from "@/hooks/useLatestRef"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

import { CardEnlargeOverlay } from "./CardLargeOverlay"

const DRAG_THRESHOLD_PX = 5

export type CardMove = {
  instanceId: string
  x: number
  y: number
}

/** Shared callbacks for the in-play FreeFloat mount. */
export type FloatSurfaceActions = {
  onMoveCards: (moves: CardMove[]) => void
  onBringToFront: (instanceId: string) => void
  onToggleExpended: (instanceIds: string[]) => void
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  onCardCounterAdjust?: (
    instanceId: string,
    kind: CardCounterKind,
    delta: number
  ) => void
}

export type FreeFloatSurfaceProps = {
  cards: PlayingCardInstance[]
  className?: string
  actions: FloatSurfaceActions
  onSelectionChange?: (instanceIds: string[]) => void
  /**
   * Pointer-up after a drag. Return `true` if the cards left this surface
   * (hand / pilot / trash / …) so we skip committing an on-field position.
   */
  onCardsReleased?: (
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) => boolean | void
  /** Right-click empty surface (not on a card). */
  onEmptyContextMenu?: (clientX: number, clientY: number) => void
  /** False for a fully read-only mount. Opponent cards on a shared field
   *  still skip drag via `localSeat`. */
  interactive?: boolean
  /** Drop the cyan frame so this surface can sit inside a shared playmat. */
  plain?: boolean
  /** Only this seat's cards can be dragged / selected. */
  localSeat?: PlayerSlot
  /**
   * Same shrink factor as the side-column piles (1 = full `lg`). Keeps
   * battlefield faces proportional to Pilot / Deck on short viewports.
   */
  cardScale?: number
  /**
   * Logical float size for clamp / pointer mapping. Rooms use the shared
   * `PLAY_FLOAT_LOGICAL`; local solo may pass a host-derived size.
   */
  fieldSize?: { width: number; height: number }
}

type DragState = {
  instanceId: string
  groupIds: string[]
  origins: Record<string, { x: number; y: number }>
  pointerId: number
  offsetX: number
  offsetY: number
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
  /** Painted/logical scale sampled in pointer handlers (not during render). */
  paintSx: number
  paintSy: number
}

type MarqueeState = {
  pointerId: number
  x0: number
  y0: number
  x1: number
  y1: number
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number) {
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
  }
}

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
) {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  )
}

function cardHitBox(
  card: PlayingCardInstance,
  cardW: number,
  cardH: number
) {
  const x = card.x ?? 0
  const y = card.y ?? 0
  if (card.expended) {
    const size = Math.max(cardW, cardH)
    return { left: x, top: y, right: x + size, bottom: y + size }
  }
  return { left: x, top: y, right: x + cardW, bottom: y + cardH }
}

function cardFootprint(
  card: PlayingCardInstance | undefined,
  cardW: number,
  cardH: number
) {
  if (card?.expended) {
    const size = Math.max(cardW, cardH)
    return { w: size, h: size }
  }
  return { w: cardW, h: cardH }
}

/**
 * Keep a drag group fully inside the surface. Shifts the whole group as one
 * rigid body so multi-select spacing is preserved.
 */
function clampMovesToSurface(
  moves: CardMove[],
  cards: PlayingCardInstance[],
  surfaceW: number,
  surfaceH: number,
  cardW: number,
  cardH: number
): CardMove[] {
  if (moves.length === 0 || surfaceW <= 0 || surfaceH <= 0) return moves

  const byId = new Map(cards.map((c) => [c.instanceId, c]))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const move of moves) {
    const { w, h } = cardFootprint(byId.get(move.instanceId), cardW, cardH)
    minX = Math.min(minX, move.x)
    minY = Math.min(minY, move.y)
    maxX = Math.max(maxX, move.x + w)
    maxY = Math.max(maxY, move.y + h)
  }

  let dx = 0
  let dy = 0
  if (minX < 0) dx += -minX
  if (minY < 0) dy += -minY
  if (maxX + dx > surfaceW) dx += surfaceW - (maxX + dx)
  if (maxY + dy > surfaceH) dy += surfaceH - (maxY + dy)
  // Group larger than the surface: pin to the top-left corner.
  if (minX + dx < 0) dx = -minX
  if (minY + dy < 0) dy = -minY

  if (dx === 0 && dy === 0) return moves
  return moves.map((move) => ({
    ...move,
    x: move.x + dx,
    y: move.y + dy,
  }))
}

export function FreeFloatSurface({
  cards,
  className,
  actions,
  onSelectionChange,
  onCardsReleased,
  onEmptyContextMenu,
  interactive = true,
  plain = false,
  localSeat = LOCAL_SEAT,
  cardScale = 1,
  fieldSize = PLAY_FLOAT_LOGICAL,
}: FreeFloatSurfaceProps) {
  const {
    onMoveCards,
    onBringToFront,
    onToggleExpended,
    onCardContextMenu,
    onCardCounterAdjust,
  } = actions
  const { w: cardW, h: cardH } = scalePlayPile("lg", cardScale)
  const cardSizeRef = useLatestRef({ w: cardW, h: cardH })
  const fieldSizeRef = useLatestRef(fieldSize)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)

  const cardsRef = useLatestRef(cards)
  const onSelectionRef = useLatestRef(onSelectionChange)
  const onMoveCardsRef = useLatestRef(onMoveCards)
  /**
   * Position tween must already be ON when left/top change (CSS can't
   * animate a past paint). Keep left/top transition armed; suppress only
   * for the paint that applies a local drop so the source doesn't "follow".
   */
  const [suppressPosTween, setSuppressPosTween] = useState(
    () => new Set<string>()
  )
  /** Instance ids present on the previous cards paint — detect fly-ins. */
  const prevCardIdsRef = useRef<Set<string>>(new Set())
  const onCardsReleasedRef = useLatestRef(onCardsReleased)
  const localSeatRef = useLatestRef(localSeat)
  const cardDragListenersRef = useRef<{
    move: (event: PointerEvent) => void
    up: (event: PointerEvent) => void
  } | null>(null)
  const marqueeListenersRef = useRef<{
    move: (event: PointerEvent) => void
    up: (event: PointerEvent) => void
  } | null>(null)

  // Cards that just appeared (deck-top fly, draw land, …) must not tween from
  // 0,0 → home — that reads as a post-drop "jump" when the ghost unhides.
  const appearedIds = new Set<string>()
  for (const card of cards) {
    if (!prevCardIdsRef.current.has(card.instanceId)) {
      appearedIds.add(card.instanceId)
    }
  }

  // After the no-tween drop / appear paint, clear suppress + advance id snapshot.
  useLayoutEffect(() => {
    prevCardIdsRef.current = new Set(cards.map((c) => c.instanceId))
    setSuppressPosTween((prev) => (prev.size === 0 ? prev : new Set()))
  }, [cards])

  function detachWindowDrag() {
    const listeners = cardDragListenersRef.current
    if (!listeners) return
    window.removeEventListener("pointermove", listeners.move, true)
    window.removeEventListener("pointerup", listeners.up, true)
    window.removeEventListener("pointercancel", listeners.up, true)
    cardDragListenersRef.current = null
  }

  function detachWindowMarquee() {
    const listeners = marqueeListenersRef.current
    if (!listeners) return
    window.removeEventListener("pointermove", listeners.move)
    window.removeEventListener("pointerup", listeners.up)
    window.removeEventListener("pointercancel", listeners.up)
    marqueeListenersRef.current = null
  }

  // Tear down any leftover window listeners on unmount.
  useEffect(() => {
    return () => {
      detachWindowDrag()
      detachWindowMarquee()
      dragRef.current = null
      marqueeRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enlarged) return
    function release() {
      setEnlarged(null)
    }
    window.addEventListener("pointerup", release)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("blur", release)
    }
  }, [enlarged])

  function surfacePaintScale() {
    const surface = surfaceRef.current
    if (!surface) return { sx: 1, sy: 1 }
    return logicalFieldPaintScale(
      surface.getBoundingClientRect(),
      fieldSizeRef.current
    )
  }

  function clientToLocal(clientX: number, clientY: number) {
    const surface = surfaceRef.current
    if (!surface) return { x: 0, y: 0 }
    // Painted rect → logical field (shared design in rooms; host-sized solo).
    return clientToLogicalField(
      clientX,
      clientY,
      surface.getBoundingClientRect(),
      fieldSizeRef.current
    )
  }

  function onSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) return
    if (event.button !== 0) return
    if (dragRef.current || marqueeRef.current) return
    event.preventDefault()

    const local = clientToLocal(event.clientX, event.clientY)
    const next: MarqueeState = {
      pointerId: event.pointerId,
      x0: local.x,
      y0: local.y,
      x1: local.x,
      y1: local.y,
    }
    marqueeRef.current = next
    setMarquee(next)

    function onMove(moveEvent: PointerEvent) {
      const current = marqueeRef.current
      if (!current || current.pointerId !== moveEvent.pointerId) return
      const point = clientToLocal(moveEvent.clientX, moveEvent.clientY)
      const updated = { ...current, x1: point.x, y1: point.y }
      marqueeRef.current = updated
      setMarquee(updated)
    }

    function onUp(upEvent: PointerEvent) {
      const current = marqueeRef.current
      if (!current || current.pointerId !== upEvent.pointerId) return
      detachWindowMarquee()
      marqueeRef.current = null
      setMarquee(null)

      const draggedFar =
        Math.hypot(current.x1 - current.x0, current.y1 - current.y0) >
        DRAG_THRESHOLD_PX

      if (!draggedFar) {
        onSelectionRef.current?.([])
        return
      }

      const box = normalizeRect(current.x0, current.y0, current.x1, current.y1)
      const { w, h } = cardSizeRef.current
      const hit = cardsRef.current
        .filter(
          (card) =>
            card.owner === localSeatRef.current &&
            rectsIntersect(box, cardHitBox(card, w, h))
        )
        .map((card) => card.instanceId)
      onSelectionRef.current?.(hit)
    }

    marqueeListenersRef.current = { move: onMove, up: onUp }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    card: PlayingCardInstance
  ) {
    if (!interactive) return
    if (card.owner !== localSeat) return
    // Counter badges own their clicks — do not select / drag / expend.
    if (
      event.target instanceof Element &&
      event.target.closest("[data-counter-badge]")
    ) {
      return
    }
    event.stopPropagation()
    if (event.button === 1) {
      event.preventDefault()
      setEnlarged(card)
      return
    }
    if (event.button !== 0) return
    if (marqueeRef.current) {
      detachWindowMarquee()
      marqueeRef.current = null
      setMarquee(null)
    }

    onBringToFront(card.instanceId)
    event.preventDefault()

    const selectedIds = cards
      .filter((c) => c.owner === localSeat && c.selected)
      .map((c) => c.instanceId)

    // Ctrl/Cmd+click toggles membership without starting a drag.
    if (event.ctrlKey || event.metaKey) {
      const nextIds = card.selected
        ? selectedIds.filter((id) => id !== card.instanceId)
        : [...selectedIds, card.instanceId]
      onSelectionRef.current?.(nextIds)
      return
    }

    const local = clientToLocal(event.clientX, event.clientY)
    const x = card.x ?? 0
    const y = card.y ?? 0

    const groupIds =
      card.selected && selectedIds.length > 0
        ? selectedIds
        : [card.instanceId]

    // Clicking an unselected card replaces the selection with just that card.
    if (!card.selected) {
      onSelectionRef.current?.([card.instanceId])
    }

    const origins: Record<string, { x: number; y: number }> = {}
    for (const id of groupIds) {
      const c = cards.find((item) => item.instanceId === id)
      origins[id] = { x: c?.x ?? 0, y: c?.y ?? 0 }
    }

    const { sx, sy } = surfacePaintScale()
    const next: DragState = {
      instanceId: card.instanceId,
      groupIds,
      origins,
      pointerId: event.pointerId,
      offsetX: local.x - x,
      offsetY: local.y - y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      // Ghost is `position: fixed` (screen px); offset is logical — convert.
      ghostX: event.clientX - (local.x - x) * sx,
      ghostY: event.clientY - (local.y - y) * sy,
      paintSx: sx,
      paintSy: sy,
    }
    dragRef.current = next
    setDrag(next)

    function onMove(moveEvent: PointerEvent) {
      const current = dragRef.current
      if (!current || current.pointerId !== moveEvent.pointerId) return

      const dist = Math.hypot(
        moveEvent.clientX - current.startX,
        moveEvent.clientY - current.startY
      )
      if (dist <= DRAG_THRESHOLD_PX && !current.moved) return

      const paint = surfacePaintScale()
      const updated: DragState = {
        ...current,
        moved: true,
        ghostX: moveEvent.clientX - current.offsetX * paint.sx,
        ghostY: moveEvent.clientY - current.offsetY * paint.sy,
        paintSx: paint.sx,
        paintSy: paint.sy,
      }
      dragRef.current = updated
      setDrag(updated)
    }

    function onUp(upEvent: PointerEvent) {
      const current = dragRef.current
      if (!current || current.pointerId !== upEvent.pointerId) return
      detachWindowDrag()

      const clientX = upEvent.clientX
      const clientY = upEvent.clientY
      const moved = current.moved
      const groupIdsAtRelease = current.groupIds

      // Prefer a zone drop (pilot / hand / trash / …) over parking on the
      // field edge — otherwise a near-miss on the side piles leaves the card
      // stuck on the playmat and feels like the slot rejected the drop.
      if (moved) {
        const rezoned = onCardsReleasedRef.current?.(
          groupIdsAtRelease,
          clientX,
          clientY
        )
        if (!rezoned) {
          const point = clientToLocal(clientX, clientY)
          const primaryX = point.x - current.offsetX
          const primaryY = point.y - current.offsetY
          const originPrimary = current.origins[current.instanceId] ?? {
            x: 0,
            y: 0,
          }
          const dx = primaryX - originPrimary.x
          const dy = primaryY - originPrimary.y

          const proposed: CardMove[] = groupIdsAtRelease.map((id) => {
            const origin = current.origins[id] ?? { x: 0, y: 0 }
            return {
              instanceId: id,
              x: origin.x + dx,
              y: origin.y + dy,
            }
          })

          const { w, h } = cardSizeRef.current
          const field = fieldSizeRef.current
          const moves = clampMovesToSurface(
            proposed,
            cardsRef.current,
            field.width,
            field.height,
            w,
            h
          )
          setSuppressPosTween(
            new Set(moves.map((move) => move.instanceId))
          )
          onMoveCardsRef.current(moves)
        }
      }

      dragRef.current = null
      setDrag(null)
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* some browsers reject capture on certain targets */
    }
    cardDragListenersRef.current = { move: onMove, up: onUp }
    window.addEventListener("pointermove", onMove, true)
    window.addEventListener("pointerup", onUp, true)
    window.addEventListener("pointercancel", onUp, true)
  }

  const marqueeBox = marquee
    ? normalizeRect(marquee.x0, marquee.y0, marquee.x1, marquee.y1)
    : null

  const draggingIds = drag?.moved ? new Set(drag.groupIds) : null
  const primaryOrigin = drag
    ? (drag.origins[drag.instanceId] ?? { x: 0, y: 0 })
    : null
  // Scale was sampled in pointer handlers — reading refs during render is banned.
  const paintSx = drag?.paintSx ?? 1
  const paintSy = drag?.paintSy ?? 1
  const ghostCards =
    drag?.moved && primaryOrigin
      ? drag.groupIds
          .map((id) => {
            const card = cards.find((c) => c.instanceId === id)
            const origin = drag.origins[id]
            if (!card || !origin) return null
            return {
              card,
              left: drag.ghostX + (origin.x - primaryOrigin.x) * paintSx,
              top: drag.ghostY + (origin.y - primaryOrigin.y) * paintSy,
            }
          })
          .filter(
            (
              item
            ): item is {
              card: PlayingCardInstance
              left: number
              top: number
            } => item != null
          )
      : []

  return (
    <>
      <div
        ref={surfaceRef}
        className={cn(
          "relative h-full min-h-0 w-full overflow-hidden",
          plain
            ? "border-0 bg-transparent"
            : "border border-cyan-500/25 bg-black/40",
          className
        )}
        onPointerDown={onSurfacePointerDown}
        onContextMenu={(event) => {
          // Card handlers stopPropagation; this only fires on empty surface.
          event.preventDefault()
          onEmptyContextMenu?.(event.clientX, event.clientY)
        }}
      >
        {cards.map((card) => {
          const isDragging = Boolean(draggingIds?.has(card.instanceId))
          const suppressTween =
            suppressPosTween.has(card.instanceId) ||
            appearedIds.has(card.instanceId)

          return (
            <div
              key={card.instanceId}
              className={cn(
                // left/top tween stays armed for remote moves; local drops
                // suppress only position (transform still spins expend/ready).
                "absolute touch-none ease-out",
                isDragging
                  ? "z-20 cursor-grabbing opacity-0"
                  : card.owner === localSeat
                    ? "z-10 cursor-grab"
                    : "z-10 cursor-default",
                cardIsPaintSelected(card, localSeat) &&
                  !isDragging &&
                  selectionRingClass()
              )}
              style={{
                left: card.x ?? 0,
                top: card.y ?? 0,
                width: cardW,
                height: cardH,
                transform: card.expended ? "rotate(90deg)" : "rotate(0deg)",
                transition: suppressTween
                  ? "transform 300ms ease-out"
                  : "left 300ms ease-out, top 300ms ease-out, transform 300ms ease-out",
              }}
              onPointerDown={(event) => onCardPointerDown(event, card)}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onCardContextMenu?.(
                  card.instanceId,
                  event.clientX,
                  event.clientY
                )
              }}
              onDoubleClick={(event) => {
                if (card.owner !== localSeat) return
                if (
                  event.target instanceof Element &&
                  event.target.closest("[data-counter-badge]")
                ) {
                  return
                }
                if (card.selected) {
                  const ids = cards
                    .filter((c) => c.owner === localSeat && c.selected)
                    .map((c) => c.instanceId)
                  onToggleExpended(ids.length > 0 ? ids : [card.instanceId])
                } else {
                  onToggleExpended([card.instanceId])
                }
              }}
            >
              <PlayingCard
                card={card}
                className="h-full w-full"
                isSelected={card.owner === localSeat && Boolean(card.selected)}
                onCounterAdjust={
                  onCardCounterAdjust
                    ? (kind, delta) =>
                        onCardCounterAdjust(card.instanceId, kind, delta)
                    : undefined
                }
              />
            </div>
          )
        })}

        {marqueeBox ? (
          <div
            className="pointer-events-none absolute z-30 border border-cyan-300/80 bg-cyan-400/15"
            style={{
              left: marqueeBox.left,
              top: marqueeBox.top,
              width: marqueeBox.right - marqueeBox.left,
              height: marqueeBox.bottom - marqueeBox.top,
            }}
          />
        ) : null}

        <CardEnlargeOverlay
          open={enlarged != null}
          name={enlarged?.name ?? ""}
          artSrc={
            enlarged ? cardArtUrl(enlarged.artPath, enlarged.artVersion) : null
          }
        />
      </div>

      {ghostCards.length > 0
        ? createPortal(
            <>
              {ghostCards.map(({ card, left, top }) => (
                <div
                  key={`ghost-${card.instanceId}`}
                  className={cn(
                    "pointer-events-none fixed z-[80]",
                    card.expended && "rotate-90",
                    cardIsPaintSelected(card, localSeat) &&
                    selectionRingClass()
                  )}
                  style={{
                    left,
                    top,
                    width: cardW * paintSx,
                    height: cardH * paintSy,
                  }}
                >
                  <PlayingCard
                    card={card}
                    className="h-full w-full"
                    isSelected={card.owner === localSeat && Boolean(card.selected)}
                  />
                </div>
              ))}
            </>,
            document.body
          )
        : null}
    </>
  )
}
