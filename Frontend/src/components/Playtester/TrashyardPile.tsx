/**
 * Face-up trashyard / dismantled / pilot pile — collapsed top card only.
 * Click (without drag) opens a deck-search style browser for the pile.
 * Drag the top card to move it onto a zone.
 */

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import { PlayingCard } from "@/components/Playtester/PlayingCard"
import { elementCssPaintScale } from "@/components/Playtester/playFieldScale.logic"
import { scalePlayPile } from "@/components/Playtester/playPileScale.logic"
import type { PlayPileSize } from "@/components/Playtester/constants"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { useLatestRef } from "@/hooks/useLatestRef"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const DRAG_THRESHOLD_PX = 5

export type TrashyardPileProps = {
  cards: PlayingCardInstance[]
  className?: string
  label?: string
  size?: PlayPileSize
  onReleaseCards: (
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) => void
  /** Click the pile (no drag) to open the search-style browser. */
  onBrowse?: () => void
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  onPileContextMenu?: (clientX: number, clientY: number) => void
  cardOverlay?: ReactNode
  onToggleExpended?: (instanceId: string) => void
  scale?: number
  /** Kept for call-site compatibility; fan UI removed in favour of browser. */
  fanDirection?: "up" | "down"
}

type TrashDrag = {
  instanceId: string
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
  paintSx: number
  paintSy: number
}

export const TrashyardPile = forwardRef<HTMLDivElement, TrashyardPileProps>(
  function TrashyardPile(
    {
      cards,
      className,
      label = "Trashyard",
      size = "md",
      onReleaseCards,
      onBrowse,
      onCardContextMenu,
      onPileContextMenu,
      cardOverlay,
      onToggleExpended,
      scale = 1,
    },
    ref
  ) {
    const { w: cardW, h: cardH } = scalePlayPile(size, scale)
    const cardBoxClass = "h-full w-full"
    const measureRef = useRef<HTMLDivElement | null>(null)

    const [drag, setDrag] = useState<TrashDrag | null>(null)
    const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)
    const dragRef = useRef<TrashDrag | null>(null)
    const onReleaseRef = useLatestRef(onReleaseCards)
    const onBrowseRef = useLatestRef(onBrowse)

    const topCard = cards.length > 0 ? cards[cards.length - 1]! : null
    const dragging = drag
    const ghostCard = dragging
      ? cards.find((c) => c.instanceId === dragging.instanceId)
      : null

    useEffect(() => {
      if (!drag) return

      function onMove(event: PointerEvent) {
        const current = dragRef.current
        if (!current || current.pointerId !== event.pointerId) return
        const dist = Math.hypot(
          event.clientX - current.startX,
          event.clientY - current.startY
        )
        if (dist <= DRAG_THRESHOLD_PX && !current.moved) return
        const paint = elementCssPaintScale(measureRef.current)
        const next: TrashDrag = {
          ...current,
          moved: true,
          ghostX: event.clientX,
          ghostY: event.clientY,
          paintSx: paint.sx,
          paintSy: paint.sy,
        }
        dragRef.current = next
        setDrag(next)
      }

      function onUp(event: PointerEvent) {
        const current = dragRef.current
        if (!current || current.pointerId !== event.pointerId) return
        dragRef.current = null
        setDrag(null)
        if (!current.moved) {
          // Click without drag → open browser (same idea as searching the deck).
          onBrowseRef.current?.()
          return
        }
        onReleaseRef.current(
          [current.instanceId],
          event.clientX,
          event.clientY
        )
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onUp)
      return () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
      }
    }, [drag])

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
      instanceId: string
    ) {
      if (event.button === 1) {
        event.preventDefault()
        event.stopPropagation()
        const card = cards.find((c) => c.instanceId === instanceId)
        if (card) setEnlarged(card)
        return
      }
      if (event.button !== 0) return
      event.preventDefault()
      const paint = elementCssPaintScale(measureRef.current)
      const next: TrashDrag = {
        instanceId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        ghostX: event.clientX,
        ghostY: event.clientY,
        paintSx: paint.sx,
        paintSy: paint.sy,
      }
      dragRef.current = next
      setDrag(next)
    }

    function onCardDoubleClick(
      event: ReactMouseEvent<HTMLDivElement>,
      instanceId: string
    ) {
      if (!onToggleExpended) return
      event.preventDefault()
      event.stopPropagation()
      onToggleExpended(instanceId)
    }

    const paintSx = dragging?.paintSx ?? 1
    const paintSy = dragging?.paintSy ?? 1

    return (
      <>
        <div
          ref={(node) => {
            measureRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
          }}
          className={cn(
            "relative z-40 flex shrink-0 flex-col items-center self-stretch",
            className
          )}
          style={{ width: cardW }}
        >
          <div
            className="relative shrink-0 overflow-visible"
            style={{ width: cardW, height: cardH }}
          >
            {cards.length === 0 ? (
              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-center border border-dashed border-cyan-500/25 bg-black/40 clip-angled"
                style={{ height: cardH }}
                onClick={() => onBrowse?.()}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onPileContextMenu?.(event.clientX, event.clientY)
                }}
              >
                <span className="font-mono text-[10px] text-white/35">Empty</span>
              </div>
            ) : (
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 touch-none select-none origin-center",
                  dragging?.moved ? "cursor-grabbing opacity-30" : "cursor-grab",
                  topCard?.expended && "rotate-90"
                )}
                style={{ width: cardW, height: cardH }}
                title={onBrowse ? "Click to browse · drag to move top card" : undefined}
                onPointerDown={(event) => {
                  if (topCard) onCardPointerDown(event, topCard.instanceId)
                }}
                onDoubleClick={(event) => {
                  if (topCard) onCardDoubleClick(event, topCard.instanceId)
                }}
                onContextMenu={(event) => {
                  if (!topCard) return
                  event.preventDefault()
                  event.stopPropagation()
                  onCardContextMenu?.(
                    topCard.instanceId,
                    event.clientX,
                    event.clientY
                  )
                }}
              >
                {topCard ? (
                  <PlayingCard card={topCard} className={cardBoxClass} />
                ) : null}
              </div>
            )}

            {cardOverlay ? (
              <div className="pointer-events-auto absolute top-1 right-1 z-30">
                {cardOverlay}
              </div>
            ) : null}
          </div>
          <p className="pointer-events-none mt-1 whitespace-nowrap font-mono text-[10px] tracking-wide text-cyan-100/70">
            {label} · {cards.length}
          </p>
        </div>

        {ghostCard && dragging?.moved
          ? createPortal(
              <div
                className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: dragging.ghostX,
                  top: dragging.ghostY,
                  width: cardW * paintSx,
                  height: cardH * paintSy,
                }}
              >
                <PlayingCard
                  card={ghostCard}
                  className={cn(
                    cardBoxClass,
                    "shadow-lg shadow-cyan-500/20",
                    ghostCard.expended && "rotate-90"
                  )}
                />
              </div>,
              document.body
            )
          : null}

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
)
