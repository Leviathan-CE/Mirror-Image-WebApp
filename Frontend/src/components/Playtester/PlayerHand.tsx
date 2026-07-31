/**
 * Bottom hand strip — cards fan in a row; drag upward onto the battlefield.
 * Empty-area drag draws a marquee to multi-select.
 * Dragging a selected card moves the whole hand selection as a group.
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import { PlayingCard } from "@/components/Playtester/PlayingCard"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { MiddleMouseScroll } from "@/components/ui/MiddleMouseScroll"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const DRAG_THRESHOLD_PX = 5
const GROUP_GHOST_STEP_X = 18

export type PlayerHandProps = {
  cards: PlayingCardInstance[]
  className?: string
  /**
   * Fired on pointer-up after a hand drag (or click-release).
   * `instanceIds` is the drag group (one card, or all selected if the
   * primary card was selected). Parent hit-tests zones and updates.
   */
  onReleaseCards: (
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) => void
  /** Right-click a hand card (zone actions). */
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  /** Right-click empty hand area (not on a card). */
  onEmptyContextMenu?: (clientX: number, clientY: number) => void
  /**
   * Selection changed via click or marquee.
   * Pass [] to clear. Parent owns `card.selected`.
   */
  onSelectionChange?: (instanceIds: string[]) => void
}

type HandDrag = {
  instanceId: string
  groupIds: string[]
  pointerId: number
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

export function PlayerHand({
  cards,
  className,
  onReleaseCards,
  onCardContextMenu,
  onEmptyContextMenu,
  onSelectionChange,
}: PlayerHandProps) {
  const dragRef = useRef<HandDrag | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const onSelectionRef = useRef(onSelectionChange)
  onSelectionRef.current = onSelectionChange
  const onReleaseRef = useRef(onReleaseCards)
  onReleaseRef.current = onReleaseCards

  const [drag, setDrag] = useState<HandDrag | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)

  const draggingIds = drag?.moved ? new Set(drag.groupIds) : null

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

  useEffect(() => {
    return () => {
      dragRef.current = null
      marqueeRef.current = null
    }
  }, [])

  function detachWindowMarquee() {
    window.removeEventListener("pointermove", onWindowMarqueeMove)
    window.removeEventListener("pointerup", onWindowMarqueeUp)
    window.removeEventListener("pointercancel", onWindowMarqueeUp)
  }

  function onWindowMarqueeMove(event: PointerEvent) {
    const current = marqueeRef.current
    if (!current || current.pointerId !== event.pointerId) return
    const next = { ...current, x1: event.clientX, y1: event.clientY }
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
    const hit: string[] = []
    for (const card of cardsRef.current) {
      const el = document.querySelector(
        `[data-playtester-instance="${CSS.escape(card.instanceId)}"]`
      )
      if (!(el instanceof HTMLElement)) continue
      const r = el.getBoundingClientRect()
      if (
        rectsIntersect(box, {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        })
      ) {
        hit.push(card.instanceId)
      }
    }
    onSelectionRef.current?.(hit)
  }

  function onEmptyPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (
      event.target instanceof Element &&
      event.target.closest("[data-playtester-instance]")
    ) {
      return
    }
    if (dragRef.current || marqueeRef.current) return
    event.preventDefault()

    const next: MarqueeState = {
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      x1: event.clientX,
      y1: event.clientY,
    }
    marqueeRef.current = next
    setMarquee(next)
    window.addEventListener("pointermove", onWindowMarqueeMove)
    window.addEventListener("pointerup", onWindowMarqueeUp)
    window.addEventListener("pointercancel", onWindowMarqueeUp)
  }

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    card: PlayingCardInstance
  ) {
    if (event.button === 1) {
      event.preventDefault()
      event.stopPropagation()
      setEnlarged(card)
      return
    }
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    if (marqueeRef.current) {
      detachWindowMarquee()
      marqueeRef.current = null
      setMarquee(null)
    }

    const selectedIds = cards
      .filter((c) => c.selected)
      .map((c) => c.instanceId)
    const groupIds =
      card.selected && selectedIds.length > 0
        ? selectedIds
        : [card.instanceId]

    // Dragging an unselected card replaces selection with just that card.
    if (!card.selected) {
      onSelectionRef.current?.([card.instanceId])
    }

    const next: HandDrag = {
      instanceId: card.instanceId,
      groupIds,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghostX: event.clientX,
      ghostY: event.clientY,
    }
    dragRef.current = next
    setDrag(next)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onCardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return

    const dist = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY
    )
    const next: HandDrag = {
      ...current,
      moved: current.moved || dist > DRAG_THRESHOLD_PX,
      ghostX: event.clientX,
      ghostY: event.clientY,
    }
    dragRef.current = next
    setDrag(next)
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return

    const groupIds = current.groupIds
    const moved = current.moved
    const clientX = event.clientX
    const clientY = event.clientY

    dragRef.current = null
    setDrag(null)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }

    if (moved) {
      onReleaseRef.current(groupIds, clientX, clientY)
    } else {
      onSelectionRef.current?.([current.instanceId])
    }
  }

  const marqueeBox = marquee
    ? normalizeRect(marquee.x0, marquee.y0, marquee.x1, marquee.y1)
    : null

  const ghostCards =
    drag?.moved
      ? drag.groupIds
          .map((id, index) => {
            const card = cards.find((c) => c.instanceId === id)
            if (!card) return null
            return {
              card,
              left: drag.ghostX + index * GROUP_GHOST_STEP_X,
              top: drag.ghostY,
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
        className={cn(
          "relative flex h-full min-h-0 w-full min-w-0 flex-col",
          className
        )}
      >
        <p className="pointer-events-none absolute top-1 left-2 z-10 font-mono text-[10px] tracking-wide text-cyan-100/70">
          Hand · {cards.length}
        </p>
        <MiddleMouseScroll
          label="Player hand"
          horizontal
          vertical={false}
          className="flex min-h-0 w-full flex-1 flex-col border border-cyan-500/25 bg-black/55"
          viewportClassName="flex min-h-32 flex-1 items-end gap-1.5 overflow-x-auto px-2 pb-1 pt-1"
        >
          <div
            className="flex h-full w-max min-w-full items-end justify-center gap-1.5"
            data-playtester-hand
            onPointerDown={onEmptyPointerDown}
            onContextMenu={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest("[data-playtester-instance]")
              ) {
                return
              }
              event.preventDefault()
              onEmptyContextMenu?.(event.clientX, event.clientY)
            }}
          >
            {cards.length === 0 ? (
              <div
                className="flex h-32 w-24 shrink-0 items-center justify-center"
                aria-hidden
              >
                <p className="font-mono text-xs text-white/35">Hand is empty</p>
              </div>
            ) : (
              cards.map((card) => {
                const isDragging = Boolean(draggingIds?.has(card.instanceId))
                return (
                  <div
                    key={card.instanceId}
                    className={cn(
                      "touch-none transition-transform duration-150",
                      isDragging
                        ? "cursor-grabbing opacity-30"
                        : "cursor-grab hover:-translate-y-2",
                      card.selected &&
                        !isDragging &&
                        "ring-2 ring-cyan-300 ring-offset-1 ring-offset-black/80"
                    )}
                    onPointerDown={(event) => onCardPointerDown(event, card)}
                    onPointerMove={onCardPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onCardContextMenu?.(
                        card.instanceId,
                        event.clientX,
                        event.clientY
                      )
                    }}
                    data-playtester-instance={card.instanceId}
                  >
                    <PlayingCard card={card} className="h-32 w-24" />
                  </div>
                )
              })
            )}
          </div>
        </MiddleMouseScroll>
      </div>

      {marqueeBox ? (
        <div
          className="pointer-events-none fixed z-[90] border border-cyan-300/80 bg-cyan-400/15"
          style={{
            left: marqueeBox.left,
            top: marqueeBox.top,
            width: marqueeBox.right - marqueeBox.left,
            height: marqueeBox.bottom - marqueeBox.top,
          }}
        />
      ) : null}

      {ghostCards.map(({ card, left, top }) => (
        <div
          key={`ghost-${card.instanceId}`}
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2"
          style={{ left, top }}
        >
          <PlayingCard
            card={card}
            className="h-32 w-24 shadow-lg shadow-cyan-500/20"
          />
        </div>
      ))}

      <CardEnlargeOverlay
        open={enlarged != null}
        name={enlarged?.name ?? ""}
        artSrc={
          enlarged ? cardArtUrl(enlarged.artPath, enlarged.artVersion) : null
        }
      />
    </>
  )
}
