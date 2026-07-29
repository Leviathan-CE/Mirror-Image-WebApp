/**
 * Free-float play surface — drag cards by {x,y}; ghost escapes overflow to reach hand.
 * Empty-surface drag draws a marquee to multi-select cards.
 * Dragging a selected card moves / rezones the whole selection as a group.
 *
 * Pointer listeners for marquee + card drag are attached synchronously on
 * pointerdown (not in useEffect) so a quick click cannot miss pointerup.
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { PlayingCard } from "@/components/Playtester/PlayingCard"
import {
  type CardCounterKind,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

import { CardEnlargeOverlay } from "./CardLargeOverlay"

const DRAG_THRESHOLD_PX = 5
/** Matches PlayingCard default footprint (w-28 h-36). */
const CARD_W = 112
const CARD_H = 144

export type CardMove = {
  instanceId: string
  x: number
  y: number
}

export type FreeFloatSurfaceProps = {
  cards: PlayingCardInstance[]
  className?: string
  onMoveCards: (moves: CardMove[]) => void
  onBringToFront: (instanceId: string) => void
  onSendToBack: (instanceId: string) => void
  onToggleExpended: (instanceIds: string[]) => void
  onSelectionChange?: (instanceIds: string[]) => void
  onCardsReleased?: (
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) => void
  /** Right-click a free-float card (zone actions / counters). */
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  /** Right-click empty surface (not on a card). */
  onEmptyContextMenu?: (clientX: number, clientY: number) => void
  /** Left-click / right-click a counter badge on a free-float card. */
  onCardCounterAdjust?: (
    instanceId: string,
    kind: CardCounterKind,
    delta: number
  ) => void
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

function cardHitBox(card: PlayingCardInstance) {
  const x = card.x ?? 0
  const y = card.y ?? 0
  if (card.expended) {
    const size = Math.max(CARD_W, CARD_H)
    return { left: x, top: y, right: x + size, bottom: y + size }
  }
  return { left: x, top: y, right: x + CARD_W, bottom: y + CARD_H }
}

function cardFootprint(card: PlayingCardInstance | undefined) {
  if (card?.expended) {
    const size = Math.max(CARD_W, CARD_H)
    return { w: size, h: size }
  }
  return { w: CARD_W, h: CARD_H }
}

/**
 * Keep a drag group fully inside the surface. Shifts the whole group as one
 * rigid body so multi-select spacing is preserved.
 */
function clampMovesToSurface(
  moves: CardMove[],
  cards: PlayingCardInstance[],
  surfaceW: number,
  surfaceH: number
): CardMove[] {
  if (moves.length === 0 || surfaceW <= 0 || surfaceH <= 0) return moves

  const byId = new Map(cards.map((c) => [c.instanceId, c]))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const move of moves) {
    const { w, h } = cardFootprint(byId.get(move.instanceId))
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
  onMoveCards,
  onBringToFront,
  onSendToBack: _onSendToBack,
  onToggleExpended,
  onSelectionChange,
  onCardsReleased,
  onCardContextMenu,
  onEmptyContextMenu,
  onCardCounterAdjust,
}: FreeFloatSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)

  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const onSelectionRef = useRef(onSelectionChange)
  onSelectionRef.current = onSelectionChange
  const onMoveCardsRef = useRef(onMoveCards)
  onMoveCardsRef.current = onMoveCards
  const onCardsReleasedRef = useRef(onCardsReleased)
  onCardsReleasedRef.current = onCardsReleased

  // Tear down any leftover window listeners on unmount.
  useEffect(() => {
    return () => {
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

  function clientToLocal(clientX: number, clientY: number) {
    const surface = surfaceRef.current
    if (!surface) return { x: 0, y: 0 }
    const rect = surface.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  function detachWindowDrag() {
    window.removeEventListener("pointermove", onWindowCardMove)
    window.removeEventListener("pointerup", onWindowCardUp)
    window.removeEventListener("pointercancel", onWindowCardUp)
  }

  function detachWindowMarquee() {
    window.removeEventListener("pointermove", onWindowMarqueeMove)
    window.removeEventListener("pointerup", onWindowMarqueeUp)
    window.removeEventListener("pointercancel", onWindowMarqueeUp)
  }

  function onWindowMarqueeMove(event: PointerEvent) {
    const current = marqueeRef.current
    if (!current || current.pointerId !== event.pointerId) return
    const local = clientToLocal(event.clientX, event.clientY)
    const next = { ...current, x1: local.x, y1: local.y }
    marqueeRef.current = next
    setMarquee(next)
  }

  function onWindowMarqueeUp(event: PointerEvent) {
    const current = marqueeRef.current
    if (!current || current.pointerId !== event.pointerId) return
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
    const hit = cardsRef.current
      .filter((card) => rectsIntersect(box, cardHitBox(card)))
      .map((card) => card.instanceId)
    onSelectionRef.current?.(hit)
  }

  function onWindowCardMove(event: PointerEvent) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return

    const dist = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY
    )
    if (dist <= DRAG_THRESHOLD_PX && !current.moved) return

    const next: DragState = {
      ...current,
      moved: true,
      ghostX: event.clientX - current.offsetX,
      ghostY: event.clientY - current.offsetY,
    }
    dragRef.current = next
    setDrag(next)
  }

  function onWindowCardUp(event: PointerEvent) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    detachWindowDrag()

    const clientX = event.clientX
    const clientY = event.clientY
    const moved = current.moved
    const groupIds = current.groupIds

    // Commit positions while ghosts still match the cursor, then clear drag.
    if (moved) {
      const local = clientToLocal(clientX, clientY)
      const primaryX = local.x - current.offsetX
      const primaryY = local.y - current.offsetY
      const originPrimary = current.origins[current.instanceId] ?? {
        x: 0,
        y: 0,
      }
      const dx = primaryX - originPrimary.x
      const dy = primaryY - originPrimary.y

      const proposed: CardMove[] = groupIds.map((id) => {
        const origin = current.origins[id] ?? { x: 0, y: 0 }
        return {
          instanceId: id,
          x: origin.x + dx,
          y: origin.y + dy,
        }
      })

      const surface = surfaceRef.current
      const bounds = surface?.getBoundingClientRect()
      const moves = clampMovesToSurface(
        proposed,
        cardsRef.current,
        bounds?.width ?? 0,
        bounds?.height ?? 0
      )
      onMoveCardsRef.current(moves)
      onCardsReleasedRef.current?.(groupIds, clientX, clientY)
    }

    dragRef.current = null
    setDrag(null)
  }

  function onSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
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

    // Attach immediately so a click’s pointerup is never missed.
    window.addEventListener("pointermove", onWindowMarqueeMove)
    window.addEventListener("pointerup", onWindowMarqueeUp)
    window.addEventListener("pointercancel", onWindowMarqueeUp)
  }

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    card: PlayingCardInstance
  ) {
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

    const local = clientToLocal(event.clientX, event.clientY)
    const x = card.x ?? 0
    const y = card.y ?? 0

    const selectedIds = cards
      .filter((c) => c.selected)
      .map((c) => c.instanceId)
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
      ghostX: event.clientX - (local.x - x),
      ghostY: event.clientY - (local.y - y),
    }
    dragRef.current = next
    setDrag(next)

    window.addEventListener("pointermove", onWindowCardMove)
    window.addEventListener("pointerup", onWindowCardUp)
    window.addEventListener("pointercancel", onWindowCardUp)
  }

  const marqueeBox = marquee
    ? normalizeRect(marquee.x0, marquee.y0, marquee.x1, marquee.y1)
    : null

  const draggingIds = drag?.moved ? new Set(drag.groupIds) : null
  const primaryOrigin = drag
    ? (drag.origins[drag.instanceId] ?? { x: 0, y: 0 })
    : null
  const ghostCards =
    drag?.moved && primaryOrigin
      ? drag.groupIds
          .map((id) => {
            const card = cards.find((c) => c.instanceId === id)
            const origin = drag.origins[id]
            if (!card || !origin) return null
            return {
              card,
              left: drag.ghostX + (origin.x - primaryOrigin.x),
              top: drag.ghostY + (origin.y - primaryOrigin.y),
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
          "relative h-full min-h-0 w-full overflow-hidden border border-cyan-500/25 bg-black/40",
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

          return (
            <div
              key={card.instanceId}
              className={cn(
                // Transform only — never transition left/top (that caused post-drop "follow").
                "absolute touch-none transition-transform duration-250 ease-out",
                isDragging
                  ? "z-20 cursor-grabbing opacity-0"
                  : "z-10 cursor-grab",
                // Keep rotate while dragging (source is opacity-0). Dropping
                // rotate-90 during drag made it re-apply on release and replay
                // the expend spin via transition-transform.
                card.expended && "rotate-90",
                card.selected &&
                  !isDragging &&
                  "ring-2 ring-cyan-300 ring-offset-1 ring-offset-black/80"
              )}
              style={{
                left: card.x ?? 0,
                top: card.y ?? 0,
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
                if (
                  event.target instanceof Element &&
                  event.target.closest("[data-counter-badge]")
                ) {
                  return
                }
                if (card.selected) {
                  const ids = cards
                    .filter((c) => c.selected)
                    .map((c) => c.instanceId)
                  onToggleExpended(ids.length > 0 ? ids : [card.instanceId])
                } else {
                  onToggleExpended([card.instanceId])
                }
              }}
            >
              <PlayingCard
                card={card}
                isSelected={card.selected}
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

      {ghostCards.map(({ card, left, top }) => (
        <div
          key={`ghost-${card.instanceId}`}
          className={cn(
            "pointer-events-none fixed z-[80]",
            card.expended && "rotate-90",
            card.selected && "ring-2 ring-cyan-300"
          )}
          style={{ left, top }}
        >
          <PlayingCard card={card} isSelected={card.selected} />
        </div>
      ))}
    </>
  )
}
