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
import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { cardArtUrl } from "@/lib/api/decks"
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
  /** Right-click on the pile (shuffle / search / degrade / …). */
  onContextMenu?: (clientX: number, clientY: number) => void
  /** Current top library card — only rendered while `topRevealed`. */
  topCard?: PlayingCardInstance | null
  /** Play with the deck's top card face up on the pile. */
  topRevealed?: boolean
}

const FLIP_MS = 450
const faceShell =
  "absolute inset-0 overflow-hidden border bg-black/80 clip-angled shadow-md shadow-black/55 [backface-visibility:hidden]"

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

/**
 * Top card that flips between its back and its face in place on the pile.
 * Every new top card starts face down, so each reveal replays the flip.
 */
function TopCardFace({
  card,
  revealed,
}: {
  card: PlayingCardInstance | null
  revealed: boolean
}) {
  const faceSrc = card ? cardArtUrl(card.artPath, card.artVersion) : null
  const [faceUp, setFaceUp] = useState(false)
  const instanceId = card?.instanceId ?? null

  useEffect(() => {
    setFaceUp(false)
    if (!revealed || !instanceId) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setFaceUp(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [instanceId, revealed])

  return (
    <div className="absolute inset-0 [perspective:800px]">
      <div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{
          transform: faceUp ? "rotateY(0deg)" : "rotateY(180deg)",
          transition: `transform ${FLIP_MS}ms ease-in-out`,
        }}
      >
        <div className={cn(faceShell, "border-cyan-400/60")}>
          {faceSrc ? (
            <img
              src={faceSrc}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center font-mono text-[10px] text-cyan-100/80">
              {card?.name}
            </span>
          )}
        </div>
        <div
          className={cn(faceShell, "border-cyan-400/60")}
          style={{ transform: "rotateY(180deg)" }}
        >
          <img
            src={sharedImages.CARD_BACK}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
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
      onContextMenu,
      topCard = null,
      topRevealed = false,
    },
    ref
  ) {
    const [hovered, setHovered] = useState(false)
    const [drag, setDrag] = useState<TopDrag | null>(null)
    const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)
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

      window.addEventListener("pointermove", onMove, true)
      window.addEventListener("pointerup", onUp, true)
      window.addEventListener("pointercancel", onUp, true)
      return () => {
        window.removeEventListener("pointermove", onMove, true)
        window.removeEventListener("pointerup", onUp, true)
        window.removeEventListener("pointercancel", onUp, true)
      }
    }, [drag])

    // Hold middle-mouse to peek (same as hand / trash / free-float).
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

    function onTopPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.button === 1 && topRevealed && topCard) {
        event.preventDefault()
        event.stopPropagation()
        setEnlarged(topCard)
        return
      }
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
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* ignore */
      }
    }

    return (
      <>
        <div
          className={cn(
            "relative flex shrink-0 flex-col items-center self-stretch",
            className
          )}
          style={{ width: CARD_W + STACK_PAD_X }}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onContextMenu?.(event.clientX, event.clientY)
          }}
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
                  aria-label={
                    topRevealed && topCard
                      ? `${label}, ${count} cards, top card ${topCard.name}`
                      : `${label}, ${count} cards`
                  }
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
                  <TopCardFace card={topCard} revealed={topRevealed} />
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

        <CardEnlargeOverlay
          open={enlarged != null}
          name={enlarged?.name ?? ""}
          artSrc={
            enlarged?.isClassified
              ? null
              : enlarged
                ? cardArtUrl(enlarged.artPath, enlarged.artVersion)
                : null
          }
          classification={
            enlarged?.classification ??
            (enlarged?.isClassified ? "classified" : null)
          }
        />
      </>
    )
  }
)
