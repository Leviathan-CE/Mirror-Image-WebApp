/**
 * Face-up trashyard (discard) pile.
 *
 * Collapsed: only the top card shows.
 * Hover: fan condensed unique faces; duplicates share one slot with ×N.
 *
 * Important: stay expanded for the whole drag. Collapsing mid-drag unmounts
 * the pointer-capture target and kills the gesture.
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
import type { PlayPileSize } from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const DRAG_THRESHOLD_PX = 5

type TrashGroup = {
  cardId: number
  display: PlayingCardInstance
  instances: PlayingCardInstance[]
}

function groupTrashCards(cards: PlayingCardInstance[]): TrashGroup[] {
  const byId = new Map<number, PlayingCardInstance[]>()
  const order: number[] = []
  for (const card of cards) {
    const list = byId.get(card.cardId)
    if (!list) {
      byId.set(card.cardId, [card])
      order.push(card.cardId)
    } else {
      list.push(card)
    }
  }
  return order.map((cardId) => {
    const instances = byId.get(cardId)!
    return {
      cardId,
      display: instances[instances.length - 1]!,
      instances,
    }
  })
}

export type TrashyardPileProps = {
  cards: PlayingCardInstance[]
  className?: string
  /** Zone title under the pile. */
  label?: string
  /** Card footprint. Default `md`. Use `lg` to match the pilot column. */
  size?: PlayPileSize
  onReleaseCard: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  /** Right-click a pile card (zone actions). */
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  /** Right-click empty pile space (e.g. Move all). */
  onPileContextMenu?: (clientX: number, clientY: number) => void
  /**
   * Optional badge drawn on top of the pile (e.g. pilot +GEN).
   * Shown even when the pile is empty so zone-persistent counters stay visible.
   */
  cardOverlay?: ReactNode
  /**
   * Double-click a pile card to expend / ready (pilot slot).
   * Omit on trashyard / dismantled — those cards are not in-play.
   */
  onToggleExpended?: (instanceId: string) => void
  /**
   * Uniform shrink for short viewports (1 = full size). Applied to the face
   * and fan peek so layout + drag rects stay aligned.
   */
  scale?: number
}

type TrashDrag = {
  instanceId: string
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
}

export const TrashyardPile = forwardRef<HTMLDivElement, TrashyardPileProps>(
  function TrashyardPile(
    {
      cards,
      className,
      label = "Trashyard",
      size = "md",
      onReleaseCard,
      onCardContextMenu,
      onPileContextMenu,
      cardOverlay,
      onToggleExpended,
      scale = 1,
    },
    ref
  ) {
    const { w: cardW, h: cardH, peek: fanPeek } = scalePlayPile(size, scale)
    const revealShift = Math.round(cardH * 0.75)
    const cardBoxClass = "h-full w-full"
    const measureRef = useRef<HTMLDivElement | null>(null)

    const [pileHovered, setPileHovered] = useState(false)
    /** Index into `groups` — covering cards above this slide away. */
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    /** Keeps the fan mounted for the whole drag if the gesture started expanded. */
    const [fanLocked, setFanLocked] = useState(false)
    const [drag, setDrag] = useState<TrashDrag | null>(null)
    const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)
    const dragRef = useRef<TrashDrag | null>(null)
    const onReleaseRef = useRef(onReleaseCard)
    onReleaseRef.current = onReleaseCard

    const groups = groupTrashCards(cards)
    const topCard = cards.length > 0 ? cards[cards.length - 1]! : null
    const expanded = (pileHovered || fanLocked) && groups.length > 0

    const dragging = drag
    const ghostCard = dragging
      ? cards.find((c) => c.instanceId === dragging.instanceId)
      : null

    // Window listeners survive leaving the pile / card bounds.
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
        const next: TrashDrag = {
          ...current,
          moved: true,
          ghostX: event.clientX,
          ghostY: event.clientY,
        }
        dragRef.current = next
        setDrag(next)
      }

      function onUp(event: PointerEvent) {
        const current = dragRef.current
        if (!current || current.pointerId !== event.pointerId) return
        dragRef.current = null
        setDrag(null)
        setFanLocked(false)
        setPileHovered(false)
        setHoveredIndex(null)
        if (!current.moved) return
        onReleaseRef.current(
          current.instanceId,
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
      // If the fan is open, lock it open until pointer-up (avoids unmount mid-drag).
      if (pileHovered || fanLocked) setFanLocked(true)
      setHoveredIndex(null)
      const next: TrashDrag = {
        instanceId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        ghostX: event.clientX,
        ghostY: event.clientY,
      }
      dragRef.current = next
      setDrag(next)
    }

    function dragInstanceIdForGroup(group: TrashGroup): string {
      return group.instances[group.instances.length - 1]!.instanceId
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

    const { sx: paintSx, sy: paintSy } = elementCssPaintScale(measureRef.current)

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
            onMouseEnter={() => {
              if (!dragRef.current) setPileHovered(true)
            }}
            onMouseLeave={() => {
              if (!dragRef.current) {
                setPileHovered(false)
                setHoveredIndex(null)
              }
            }}
          >
            {cards.length === 0 ? (
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 flex items-center justify-center",
                  "border border-dashed border-cyan-500/25 bg-black/40 clip-angled"
                )}
                style={{ height: cardH }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onPileContextMenu?.(event.clientX, event.clientY)
                }}
              >
                <span className="font-mono text-[10px] text-white/35">Empty</span>
              </div>
            ) : expanded ? (
              groups.map((group, index) => {
                const qty = group.instances.length
                const instanceId = dragInstanceIdForGroup(group)
                const isDragging =
                  dragging?.instanceId === instanceId && dragging.moved
                const isHovered =
                  hoveredIndex === index && !dragging?.moved
                // Higher index = on top of the hovered card → slide up to reveal.
                const isCovering =
                  hoveredIndex != null &&
                  index > hoveredIndex &&
                  !isHovered &&
                  !dragging?.moved

                return (
                  <div
                    key={group.cardId}
                    className={cn(
                      "absolute left-0 touch-none select-none",
                      "origin-center transition-[transform,filter] duration-220 ease-out",
                      isDragging
                        ? "cursor-grabbing opacity-30"
                        : "cursor-grab"
                    )}
                    style={{
                      bottom: index * fanPeek,
                      width: cardW,
                      height: cardH,
                      zIndex: index + 1,
                      transform: [
                        isHovered
                          ? "scale(1.06)"
                          : isCovering
                            ? `translateY(-${revealShift}px)`
                            : "translateY(0) scale(1)",
                        group.display.expended ? "rotate(90deg)" : "",
                      ]
                        .filter(Boolean)
                        .join(" "),
                      filter: isHovered
                        ? "brightness(1.08)"
                        : isCovering
                          ? "brightness(0.88)"
                          : "brightness(0.95)",
                    }}
                    onMouseEnter={() => {
                      if (!dragRef.current) setHoveredIndex(index)
                    }}
                    onPointerDown={(event) =>
                      onCardPointerDown(event, instanceId)
                    }
                    onDoubleClick={(event) =>
                      onCardDoubleClick(event, instanceId)
                    }
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onCardContextMenu?.(
                        instanceId,
                        event.clientX,
                        event.clientY
                      )
                    }}
                  >
                    <PlayingCard
                      card={group.display}
                      className={cardBoxClass}
                    />
                    {qty > 1 ? (
                      <span
                        className={cn(
                          "pointer-events-none absolute bottom-1 right-1 z-10",
                          "border border-cyan-400/50 bg-black/80 px-1.5 py-0.5",
                          "font-mono text-[10px] text-cyan-100"
                        )}
                      >
                        ×{qty}
                      </span>
                    ) : null}
                  </div>
                )
              })
            ) : (
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 touch-none select-none origin-center transition-transform duration-250 ease-out",
                  dragging?.moved ? "cursor-grabbing opacity-30" : "cursor-grab",
                  topCard?.expended && "rotate-90"
                )}
                style={{ width: cardW, height: cardH }}
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
