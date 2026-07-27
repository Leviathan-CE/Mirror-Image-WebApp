/**
 * Draw deck / library pile.
 *
 * Under-stack stays still; top card lifts on hover and can be dragged
 * to hand / battlefield / trashyard (parent runs the flip animation).
 * Click (no drag) still draws to hand.
 */

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { sharedImages } from "@/assets/shared"
import { cn } from "@/lib/utils"

const MAX_UNDER_LAYERS = 5
const STACK_STEP_X = 3
const STACK_STEP_Y = 3
const TOP_LIFT_PX = 14
const DRAG_THRESHOLD_PX = 5
/** Card face size (matches hand / trash md). */
const CARD_W = 96
const CARD_H = 128
/** Layout must reserve this — under-cards paint outside the face box. */
const STACK_PAD_X = MAX_UNDER_LAYERS * STACK_STEP_X

export type DeckPileProps = {
  count: number
  className?: string
  label?: string
  /** True while a flip animation is running. */
  busy?: boolean
  /** Click with no drag — usually draw top card to hand. */
  onClickDraw?: () => void
  /**
   * Drag-release of the top card. Parent hit-tests zones and starts
   * the back→face fly animation.
   */
  onTopCardRelease?: (clientX: number, clientY: number) => void
}

function CardBackFace({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden border border-cyan-500/40 bg-black/80",
        "clip-angled shadow-md shadow-black/55",
        className
      )}
    >
      <img
        src={sharedImages.CARD_BACK}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
    </div>
  )
}

type TopDrag = {
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  ghostX: number
  ghostY: number
}

export const DeckPile = forwardRef<HTMLDivElement, DeckPileProps>(
  function DeckPile(
    {
      count,
      className,
      label = "Deck",
      busy = false,
      onClickDraw,
      onTopCardRelease,
    },
    ref
  ) {
    const [hovered, setHovered] = useState(false)
    const [drag, setDrag] = useState<TopDrag | null>(null)
    const dragRef = useRef<TopDrag | null>(null)
    const onReleaseRef = useRef(onTopCardRelease)
    const onClickRef = useRef(onClickDraw)
    onReleaseRef.current = onTopCardRelease
    onClickRef.current = onClickDraw

    const interactive = !busy && count > 0
    const underCount =
      count <= 1 ? 0 : Math.min(MAX_UNDER_LAYERS, count - 1)

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
        const next: TopDrag = {
          ...current,
          moved: true,
          ghostX: event.clientX,
          ghostY: event.clientY,
        }
        dragRef.current = next
        setDrag(next)
        setHovered(false)
      }

      function onUp(event: PointerEvent) {
        const current = dragRef.current
        if (!current || current.pointerId !== event.pointerId) return
        dragRef.current = null
        setDrag(null)
        setHovered(false)

        const moved = current.moved
        if (!moved) {
          onClickRef.current?.()
          return
        }
        onReleaseRef.current?.(event.clientX, event.clientY)
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

    function onTopPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.button !== 0 || !interactive) return
      event.preventDefault()
      event.stopPropagation()
      const next: TopDrag = {
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

    return (
      <>
        <div
          className={cn(
            "relative flex shrink-0 flex-col items-center self-stretch",
            className
          )}
          style={{ width: CARD_W + STACK_PAD_X }}
        >
          {/*
            Outer box owns the full visual footprint (face + right/up stack).
            Face sits bottom-left so overhang stays inside layout, not over trash.
          */}
          <div
            className="relative shrink-0 overflow-visible"
            style={{
              width: CARD_W + STACK_PAD_X,
              height: CARD_H,
            }}
          >
            <div
              ref={ref}
              className="absolute bottom-0 left-0"
              style={{ width: CARD_W, height: CARD_H }}
            >
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {Array.from({ length: underCount }, (_, i) => {
                  const depth = underCount - i
                  return (
                    <div
                      key={`under-${i}`}
                      className="absolute inset-0"
                      style={{
                        transform: `translate(${depth * STACK_STEP_X}px, ${-depth * STACK_STEP_Y}px)`,
                        zIndex: i + 1,
                      }}
                    >
                      <CardBackFace />
                    </div>
                  )
                })}
              </div>

              {count > 0 ? (
                <div
                  role="button"
                  tabIndex={interactive ? 0 : -1}
                  aria-label={`${label}, ${count} cards`}
                  aria-disabled={!interactive}
                  onPointerDown={onTopPointerDown}
                  onMouseEnter={() => {
                    if (!dragRef.current && interactive) setHovered(true)
                  }}
                  onMouseLeave={() => {
                    if (!dragRef.current) setHovered(false)
                  }}
                  className={cn(
                    "absolute inset-0 z-20 touch-none select-none p-0",
                    interactive ? "cursor-grab" : "cursor-default",
                    drag?.moved && "cursor-grabbing opacity-30"
                  )}
                  style={{
                    transform:
                      interactive && hovered && !drag?.moved
                        ? `translateY(-${TOP_LIFT_PX}px)`
                        : "translateY(0px)",
                    transition: drag?.moved
                      ? undefined
                      : "transform 150ms ease-out",
                  }}
                >
                  <CardBackFace className="border-cyan-400/60" />
                </div>
              ) : (
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    "border border-dashed border-cyan-500/25 bg-black/40 clip-angled"
                  )}
                >
                  <span className="font-mono text-[10px] text-white/35">
                    Empty
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="pointer-events-none mt-1 whitespace-nowrap font-mono text-[10px] tracking-wide text-cyan-100/70">
            {label} · {count}
          </p>
        </div>

        {drag?.moved ? (
          <div
            className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2"
            style={{
              left: drag.ghostX,
              top: drag.ghostY,
              width: CARD_W,
              height: CARD_H,
            }}
          >
            <CardBackFace className="border-cyan-400/60 shadow-lg shadow-cyan-500/20" />
          </div>
        ) : null}
      </>
    )
  }
)
