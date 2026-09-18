/**
 * Hand window — cards fan in a row; drag onto the battlefield.
 * Can sit in a floating panel (`embedded`) or as a standalone strip.
 * Empty-area drag draws a marquee to multi-select.
 * Ctrl/Cmd+click toggles a card in or out of the selection.
 * Dragging a selected card moves the whole hand selection as a group.
 *
 * Card drag move/up listen on `window` (capture). Relying only on the card
 * element + setPointerCapture breaks on macOS/Safari: leaving the scrollable
 * hand fires lostpointercapture, the ghost freezes, and zone drops never fire.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import { CardEnlargeOverlay } from "@/components/Playtester/board/CardLargeOverlay"
import {
  handCardSizePx,
  peekPortalBox,
  peekStickOutSlot,
  scaleHandCardPx,
  shownHandHoverIndex,
} from "@/components/Playtester/board/handCardSize.logic"
import { elementCssPaintScale } from "@/components/Playtester/board/playFieldScale.logic"
import { PlayingCard } from "@/components/Playtester/board/PlayingCard"
import { HAND_CARD_SIZE, LOCAL_SEAT, type PlayerSlot } from "@/components/Playtester/constants"
import {
  cardIsPaintSelected,
  selectionRingClass,
} from "@/components/Playtester/board/selectionChrome"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { MiddleMouseScroll } from "@/components/ui/MiddleMouseScroll"
import { useLatestRef } from "@/hooks/useLatestRef"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const DRAG_THRESHOLD_PX = 5
const GROUP_GHOST_STEP_RATIO = 18 / HAND_CARD_SIZE.defaultWidth
/**
 * Grace period before collapsing: the sliver and the raised overlay are
 * separate elements, so moving between them briefly leaves both at once.
 */
const PEEK_COLLAPSE_DELAY_MS = 120
/** Extra size on the inspected card while the peek overlay is open. */
const PEEK_HOVER_SCALE = 1.28
/** Logical px the opponent sliver grows when they inspect a card. */
const PEEK_STICK_OUT_NUDGE_PX = 22

export type HandPeekConfig = {
  /** Height (px, logical/unscaled) of the always-visible sliver at rest. */
  collapsedPx: number
  /** Card row height (px, logical/unscaled) once raised on hover. */
  expandedPx: number
  /** Which edge of the dock the strip sits against — sets which way it rises. */
  anchor: "top" | "bottom"
}

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
  /** Opponent fog: render card backs and ignore pointer. */
  hideFaces?: boolean
  interactive?: boolean
  /** Skip the built-in label + frame when the hand lives in a window. */
  embedded?: boolean
  /**
   * Remote (or forced) hover slot — lifts that index so the peer can see
   * which fog-hand back you're inspecting. `null` clears.
   */
  hoveredIndex?: number | null
  /** Local hover changed — parent may relay index over the net. */
  onHoverIndexChange?: (index: number | null) => void
  /** Seat at the bottom of this client — colours selection rings. */
  localSeat?: PlayerSlot
  /**
   * Collapse the docked strip to a peek sliver at rest; hovering raises the
   * full, interactive hand in a floating overlay so the battlefield can
   * reclaim the space a full-height strip would otherwise cost.
   */
  peek?: HandPeekConfig
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

export function PlayerHand({
  cards,
  className,
  onReleaseCards,
  onCardContextMenu,
  onEmptyContextMenu,
  onSelectionChange,
  hideFaces = false,
  interactive = true,
  embedded = false,
  hoveredIndex = null,
  onHoverIndexChange,
  localSeat = LOCAL_SEAT,
  peek,
}: PlayerHandProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  // While peek is raised, cards render inside a portal instead — drag math
  // must sample whichever container is actually painted right now.
  const peekPortalRef = useRef<HTMLDivElement | null>(null)
  function surfaceEl() {
    return peekPortalRef.current ?? rootRef.current
  }
  const [cardPx, setCardPx] = useState(() =>
    peek
      ? handCardSizePx(peek.expandedPx + HAND_CARD_SIZE.chromeY)
      : handCardSizePx(HAND_CARD_SIZE.defaultHeight + HAND_CARD_SIZE.chromeY)
  )
  const dragRef = useRef<HandDrag | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const cardsRef = useLatestRef(cards)
  const onSelectionRef = useLatestRef(onSelectionChange)
  const onReleaseRef = useLatestRef(onReleaseCards)

  useEffect(() => {
    // Peek cards are sized once, from the initial state above — the
    // collapsed sliver crops them, it never shrinks them, so there is
    // nothing to fit to the (tiny) dock height here.
    if (peek) return
    const el = rootRef.current
    if (!el) return
    const sync = () => setCardPx(handCardSizePx(el.clientHeight))
    const raf = requestAnimationFrame(sync)
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [peek])

  const [peekExpanded, setPeekExpanded] = useState(false)
  const [localHoverIndex, setLocalHoverIndex] = useState<number | null>(null)
  const onHoverIndexRef = useLatestRef(onHoverIndexChange)
  const shownHoverIndex = shownHandHoverIndex(hoveredIndex, localHoverIndex)
  const peekRaised = Boolean(peek) && peekExpanded
  const stickOut =
    Boolean(peek) &&
    !peekRaised &&
    !interactive &&
    shownHoverIndex != null
  // Overlay lives on `document.body` (outside the board's fit-scale). Cards
  // inside it are sized in *painted* px (`rowCardPx`) so we never CSS-scale
  // raster art — that squash is what made the hand look soft.
  const [peekPortalStyle, setPeekPortalStyle] = useState<{
    left: number
    top: number
    paintedWidth: number
    paintedHeight: number
    sx: number
    sy: number
  } | null>(null)
  const peekCollapseTimerRef = useRef<number | null>(null)

  function clearPeekCollapseTimer() {
    if (peekCollapseTimerRef.current == null) return
    window.clearTimeout(peekCollapseTimerRef.current)
    peekCollapseTimerRef.current = null
  }

  function openPeek() {
    if (!peek) return
    clearPeekCollapseTimer()
    setPeekExpanded(true)
  }

  function closePeekSoon() {
    if (!peek || dragRef.current) return
    clearPeekCollapseTimer()
    peekCollapseTimerRef.current = window.setTimeout(() => {
      setPeekExpanded(false)
    }, PEEK_COLLAPSE_DELAY_MS)
  }

  function reportHoverIndex(index: number | null) {
    if (!interactive) return
    setLocalHoverIndex(index)
    onHoverIndexRef.current?.(index)
  }

  useEffect(() => clearPeekCollapseTimer, [])

  useEffect(() => {
    if (localHoverIndex == null) return
    if (localHoverIndex < cards.length) return
    setLocalHoverIndex(null)
    onHoverIndexRef.current?.(null)
  }, [cards.length, localHoverIndex, onHoverIndexRef])

  // Position the overlay from the dock's live painted rect. Keep it mounted
  // collapsed *and* expanded so the sliver is never under the board scale.
  // Animate `top`/`height` — do not use `transform` on this layer.
  useLayoutEffect(() => {
    if (!peek) {
      setPeekPortalStyle(null)
      return
    }

    function sync() {
      if (!peek) return
      const dockEl = rootRef.current
      if (!dockEl) return
      const rect = dockEl.getBoundingClientRect()
      const { sx, sy } = elementCssPaintScale(dockEl)
      const box = peekPortalBox({
        dock: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          bottom: rect.bottom,
        },
        anchor: peek.anchor,
        collapsedPx: peek.collapsedPx,
        expandedPx: peek.expandedPx,
        expanded: peekRaised,
        sy,
        hoverScale: PEEK_HOVER_SCALE,
        stickOutNudgePx: stickOut ? PEEK_STICK_OUT_NUDGE_PX : undefined,
      })
      setPeekPortalStyle({ ...box, sx, sy })
    }

    sync()
    const dockEl = rootRef.current
    if (!dockEl) return
    const observer = new ResizeObserver(sync)
    observer.observe(dockEl)
    window.addEventListener("resize", sync)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", sync)
    }
  }, [peek, peekRaised, stickOut])

  /** Exact listener refs attached for this gesture (identity must match remove). */
  const cardDragListenersRef = useRef<{
    move: (event: PointerEvent) => void
    up: (event: PointerEvent) => void
  } | null>(null)
  const marqueeListenersRef = useRef<{
    move: (event: PointerEvent) => void
    up: (event: PointerEvent) => void
  } | null>(null)

  const [drag, setDrag] = useState<HandDrag | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [enlarged, setEnlarged] = useState<PlayingCardInstance | null>(null)

  const draggingIds = drag?.moved ? new Set(drag.groupIds) : null

  function detachWindowCardDrag() {
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
      detachWindowCardDrag()
      detachWindowMarquee()
      dragRef.current = null
      marqueeRef.current = null
    }
  }, [])

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

    function onMove(moveEvent: PointerEvent) {
      const current = marqueeRef.current
      if (!current || current.pointerId !== moveEvent.pointerId) return
      const updated = {
        ...current,
        x1: moveEvent.clientX,
        y1: moveEvent.clientY,
      }
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
      const hit: string[] = []
      for (const item of cardsRef.current) {
        const el = document.querySelector(
          `[data-playtester-instance="${CSS.escape(item.instanceId)}"]`
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
          hit.push(item.instanceId)
        }
      }
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

    // Ctrl/Cmd+click toggles membership without starting a drag.
    if (event.ctrlKey || event.metaKey) {
      const nextIds = card.selected
        ? selectedIds.filter((id) => id !== card.instanceId)
        : [...selectedIds, card.instanceId]
      onSelectionRef.current?.(nextIds)
      return
    }

    const groupIds =
      card.selected && selectedIds.length > 0
        ? selectedIds
        : [card.instanceId]

    // Dragging an unselected card replaces selection with just that card.
    if (!card.selected) {
      onSelectionRef.current?.([card.instanceId])
    }

    const paint = elementCssPaintScale(surfaceEl())
    const next: HandDrag = {
      instanceId: card.instanceId,
      groupIds,
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

    function onMove(moveEvent: PointerEvent) {
      const current = dragRef.current
      if (!current || current.pointerId !== moveEvent.pointerId) return

      const dist = Math.hypot(
        moveEvent.clientX - current.startX,
        moveEvent.clientY - current.startY
      )
      if (dist <= DRAG_THRESHOLD_PX && !current.moved) return

      const nextPaint = elementCssPaintScale(surfaceEl())
      const updated: HandDrag = {
        ...current,
        moved: true,
        ghostX: moveEvent.clientX,
        ghostY: moveEvent.clientY,
        paintSx: nextPaint.sx,
        paintSy: nextPaint.sy,
      }
      dragRef.current = updated
      setDrag(updated)
    }

    function onUp(upEvent: PointerEvent) {
      const current = dragRef.current
      if (!current || current.pointerId !== upEvent.pointerId) return
      detachWindowCardDrag()

      const groupIdsAtRelease = current.groupIds
      const moved = current.moved
      const clientX = upEvent.clientX
      const clientY = upEvent.clientY

      dragRef.current = null
      setDrag(null)

      if (moved) {
        onReleaseRef.current(groupIdsAtRelease, clientX, clientY)
      } else {
        onSelectionRef.current?.([current.instanceId])
      }
      // Drag held the peek open past whatever triggered it; let it settle.
      closePeekSoon()
    }

    // Capture helps suppress scroll/gestures; window listeners (capture phase)
    // keep the ghost tracking after Safari drops element capture.
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

  // Peek overlay is outside the board scale, so layout cards in painted px
  // for both the collapsed sliver and the raised row.
  const rowCardPx =
    peek && peekPortalStyle
      ? scaleHandCardPx(cardPx, peekPortalStyle.sx, peekPortalStyle.sy)
      : cardPx
  const sliverPx =
    peek && peekPortalStyle
      ? Math.round(peek.collapsedPx * peekPortalStyle.sy)
      : rowCardPx.height

  // Scale sampled in pointer handlers — do not read refs during render.
  const paintSx = drag?.paintSx ?? 1
  const paintSy = drag?.paintSy ?? 1
  const ghostCards =
    drag?.moved
      ? drag.groupIds
          .map((id, index) => {
            const card = cards.find((c) => c.instanceId === id)
            if (!card) return null
            const step = Math.round(
              rowCardPx.width * GROUP_GHOST_STEP_RATIO * paintSx
            )
            return {
              card,
              left: drag.ghostX + index * step,
              top: drag.ghostY,
              width: rowCardPx.width * paintSx,
              height: rowCardPx.height * paintSy,
            }
          })
          .filter(
            (
              item
            ): item is {
              card: PlayingCardInstance
              left: number
              top: number
              width: number
              height: number
            } => item != null
          )
      : []

  // Which edge of the card box sits in the strip. Own hand: tops in the
  // sliver, bottoms clipped off-screen (items-start collapsed). Opponent
  // cards are rotate-180, so their visual tops live at the *bottom* of the
  // box — pin collapsed to items-end or you see the bottoms and clip down.
  function peekRowAlign(): "items-start" | "items-end" {
    if (!peek) return "items-end"
    const pinToDock = peekRaised || stickOut
    if (peek.anchor === "bottom") {
      return pinToDock ? "items-end" : "items-start"
    }
    return pinToDock ? "items-start" : "items-end"
  }

  // Shared row markup: rendered inline (clipped to a peek sliver) or raised
  // into a portal, never both at once — see the `peek` branch below.
  const handRow = (
    <>
      {embedded ? null : (
        <p className="pointer-events-none absolute top-1 left-2 z-10 font-mono text-[10px] tracking-wide text-cyan-100/70">
          Hand · {cards.length}
        </p>
      )}
      <MiddleMouseScroll
        label="Player hand"
        horizontal
        vertical={false}
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col",
          embedded ? "bg-transparent" : "border border-cyan-500/25 bg-black/55"
        )}
        // Scrollport stays a plain overflow box (not a centering flex). Padding
        // on the row is part of scrollWidth so first/last cards can scroll fully
        // into view. before/after + m-auto centers when there is spare width and
        // collapses when the row overflows (unlike justify-center, which clips
        // the start and makes it unreachable).
        viewportClassName={
          peek
            ? "min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-0"
            : embedded
              ? "min-h-0 flex-1 overflow-x-auto pb-1 pt-4"
              : "min-h-32 flex-1 overflow-x-auto pb-1 pt-4"
        }
      >
        <div
          className={cn(
            "flex h-full w-max min-w-full gap-1.5 px-3",
            peekRowAlign(),
            peek?.anchor === "top" && "flex-row-reverse",
            "before:m-auto before:content-[''] after:m-auto after:content-['']"
          )}
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
              className="flex shrink-0 items-center justify-center"
              style={{ width: rowCardPx.width, height: rowCardPx.height }}
              aria-hidden
            >
              <p className="font-mono text-xs text-white/35">Hand is empty</p>
            </div>
          ) : (
            cards.map((card, index) => {
              const isDragging = Boolean(draggingIds?.has(card.instanceId))
              const isHovered = shownHoverIndex === index
              const bump =
                Boolean(peek) &&
                isHovered &&
                !isDragging &&
                (peekRaised || stickOut)
              const stick = stickOut
                ? peekStickOutSlot({
                    hovered: bump,
                    sliverPx,
                    card: rowCardPx,
                    nudgePx: Math.round(
                      PEEK_STICK_OUT_NUDGE_PX * (peekPortalStyle?.sy ?? 1)
                    ),
                  })
                : null
              const faceW = stick
                ? stick.faceW
                : bump
                  ? Math.round(rowCardPx.width * PEEK_HOVER_SCALE)
                  : rowCardPx.width
              const faceH = stick
                ? stick.faceH
                : bump
                  ? Math.round(rowCardPx.height * PEEK_HOVER_SCALE)
                  : rowCardPx.height
              const slotW = stick ? stick.slotW : rowCardPx.width
              const slotH = stick ? stick.slotH : rowCardPx.height
              const cropToSliver = Boolean(stick)
              const pinToTop =
                peek?.anchor === "top"
                  ? !cropToSliver
                  : cropToSliver
              return (
                <div
                  key={card.instanceId}
                  className={cn(
                    "relative shrink-0 touch-none",
                    cropToSliver && "overflow-hidden",
                    peek ? null : "transition-transform duration-150",
                    isDragging
                      ? "cursor-grabbing opacity-30"
                      : interactive
                        ? peek
                          ? "cursor-grab"
                          : "cursor-grab hover:-translate-y-2"
                        : "cursor-default",
                    bump && "z-20",
                    !peek &&
                      isHovered &&
                      !isDragging &&
                      "-translate-y-2",
                    cardIsPaintSelected(card, localSeat) &&
                      !isDragging &&
                      selectionRingClass()
                  )}
                  style={{
                    width: slotW,
                    height: slotH,
                    transition: stick
                      ? "height 150ms ease-out, width 150ms ease-out"
                      : undefined,
                  }}
                  onPointerDown={(event) => {
                    if (!interactive) return
                    onCardPointerDown(event, card)
                  }}
                  onPointerEnter={() => {
                    reportHoverIndex(index)
                  }}
                  onPointerLeave={() => {
                    reportHoverIndex(null)
                  }}
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
                  <div
                    className={
                      peek
                        ? "absolute left-1/2"
                        : "h-full w-full"
                    }
                    style={
                      peek
                        ? {
                            width: faceW,
                            height: faceH,
                            marginLeft: -faceW / 2,
                            bottom: pinToTop ? undefined : 0,
                            top: pinToTop ? 0 : undefined,
                            transition:
                              "width 150ms ease-out, height 150ms ease-out, margin-left 150ms ease-out",
                          }
                        : undefined
                    }
                  >
                    <PlayingCard
                      card={hideFaces ? { ...card, faceDown: true } : card}
                      flat={Boolean(peek)}
                      className={cn(
                        "h-full w-full",
                        peek?.anchor === "top" && "rotate-180"
                      )}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </MiddleMouseScroll>
    </>
  )

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "relative flex h-full min-h-0 w-full min-w-0 flex-col",
          peek && "overflow-hidden",
          className
        )}
        onPointerEnter={peek ? openPeek : undefined}
        onPointerLeave={peek ? closePeekSoon : undefined}
      >
        {peek ? null : handRow}
      </div>

      {peek && peekPortalStyle
        ? createPortal(
            <div
              ref={peekPortalRef}
              className={cn(
                "fixed z-[70] overflow-hidden transition-[top,height] duration-150 ease-out",
                stickOut && "pointer-events-none"
              )}
              style={{
                left: peekPortalStyle.left,
                top: peekPortalStyle.top,
                width: peekPortalStyle.paintedWidth,
                height: peekPortalStyle.paintedHeight,
              }}
              onPointerEnter={stickOut ? undefined : openPeek}
              onPointerLeave={stickOut ? undefined : closePeekSoon}
            >
              <div className="absolute inset-0 flex flex-col">
                {handRow}
              </div>
            </div>,
            document.body
          )
        : null}

      {marqueeBox
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[90] border border-cyan-300/80 bg-cyan-400/15"
              style={{
                left: marqueeBox.left,
                top: marqueeBox.top,
                width: marqueeBox.right - marqueeBox.left,
                height: marqueeBox.bottom - marqueeBox.top,
              }}
            />,
            document.body
          )
        : null}

      {ghostCards.length > 0
        ? createPortal(
            <>
              {ghostCards.map(({ card, left, top, width, height }) => (
                <div
                  key={`ghost-${card.instanceId}`}
                  className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2"
                  style={{ left, top, width, height }}
                >
                  <PlayingCard
                    card={card}
                    className="h-full w-full shadow-lg shadow-cyan-500/20"
                  />
                </div>
              ))}
            </>,
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
