/**
 * Bottom hand strip — cards fan in a row; drag upward onto the battlefield.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import { PlayingCard } from "@/components/Playtester/PlayingCard"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { MiddleMouseScroll } from "@/components/ui/MiddleMouseScroll"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const DRAG_THRESHOLD_PX = 5

export type PlayerHandProps = {
  cards: PlayingCardInstance[]
  className?: string
  /**
   * Fired on pointer-up after a hand drag (or click-release).
   * Parent hit-tests battlefield vs hand and updates zone.
   */
  onReleaseCard: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  /** Right-click a hand card (zone actions). */
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
}

type HandDrag = {
  instanceId: string
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
}

export function PlayerHand({
  cards,
  className,
  onReleaseCard,
  onCardContextMenu,
}: PlayerHandProps) {
  const dragRef = useRef<HandDrag | null>(null)
  const [drag, setDrag] = useState<HandDrag | null>(null)
  const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)

  const dragging = drag
  const ghostCard = dragging
    ? cards.find((c) => c.instanceId === dragging.instanceId)
    : null

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

    const next: HandDrag = {
      instanceId: card.instanceId,
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

    dragRef.current = null
    setDrag(null)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }

    onReleaseCard(current.instanceId, event.clientX, event.clientY)
  }

  return (
    <>
      <div className={cn("flex w-full min-w-0 flex-col", className)}>
        <p className="mb-1 font-mono text-[10px] tracking-wide text-cyan-100/70">
          Hand · {cards.length}
        </p>
        <MiddleMouseScroll
          label="Player hand"
          horizontal
          vertical={false}
          // Fixed hand chrome height: viewport + reserved scrollbar slot so
          // empty ↔ cards (and scrollbar appearing) does not jump the layout.
          className="w-full border border-cyan-500/25 bg-black/55"
          viewportClassName="flex h-36 min-h-36 items-end gap-2 overflow-x-auto px-3 pt-2"
        >
          <div
            className="flex h-full w-max min-w-full items-end justify-center gap-2"
            data-playtester-hand
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
                const isDragging = dragging?.instanceId === card.instanceId
                return (
                  <div
                    key={card.instanceId}
                    className={cn(
                      "touch-none transition-transform duration-150",
                      isDragging
                        ? "cursor-grabbing opacity-30"
                        : "cursor-grab hover:-translate-y-2"
                    )}
                    onPointerDown={(event) => onCardPointerDown(event, card)}
                    onPointerMove={onCardPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onContextMenu={(event) => {
                      event.preventDefault()
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
        {/* Always reserve the horizontal scrollbar band (h-2 + mt-1). */}
        <div className="mt-1 h-2 shrink-0" aria-hidden />
      </div>

      {ghostCard && dragging?.moved ? (
        <div
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragging.ghostX, top: dragging.ghostY }}
        >
          <PlayingCard
            card={ghostCard}
            className="h-32 w-24 shadow-lg shadow-cyan-500/20"
          />
        </div>
      ) : null}

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
