/**
 * Custom scrollport with styled scrollbar + middle-mouse drag pan.
 * Wheel up/down pans horizontally when `vertical={false}` (or with Shift when both axes).
 * Middle-button drag still pans like a hand tool.
 *
 * Scrollbar clicks match common OS behavior:
 * - drag the thumb to scroll
 * - click the track to page toward that point (not absolute-jump)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
} from "react"

import { cn } from "@/lib/utils"

export type MiddleMouseScrollProps = {
  children: ReactNode
  className?: string
  /** Inline style for the wrapper — e.g. a user-resized height. */
  style?: CSSProperties
  /** Scrollport class (the element that overflows). */
  viewportClassName?: string
  /** Allow horizontal overflow / scrollbar. Default true. */
  horizontal?: boolean
  /** Allow vertical overflow / scrollbar. Default true. */
  vertical?: boolean
  /** Accessible name for the scroll region. */
  label?: string
}

type PanState = {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}

type ThumbLayout = {
  size: number
  offset: number
  track: number
}

type ThumbDragState = {
  axis: "x" | "y"
  pointerId: number
  startPointer: number
  startOffset: number
  thumbSize: number
  trackSize: number
  maxScroll: number
}

function thumbLayout(
  scrollPos: number,
  clientSize: number,
  scrollSize: number
): ThumbLayout | null {
  if (scrollSize <= clientSize + 1) return null
  const track = clientSize
  const size = Math.max(24, (clientSize / scrollSize) * track)
  const maxOffset = track - size
  const maxScroll = scrollSize - clientSize
  const offset = maxScroll <= 0 ? 0 : (scrollPos / maxScroll) * maxOffset
  return { size, offset, track }
}

export function MiddleMouseScroll({
  children,
  className,
  style,
  viewportClassName,
  horizontal = true,
  vertical = true,
  label = "Scrollable area",
}: MiddleMouseScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<PanState | null>(null)
  const thumbDragRef = useRef<ThumbDragState | null>(null)
  const hThumbRef = useRef<ThumbLayout | null>(null)
  const vThumbRef = useRef<ThumbLayout | null>(null)
  const [panning, setPanning] = useState(false)
  const [hThumb, setHThumb] = useState<ThumbLayout | null>(null)
  const [vThumb, setVThumb] = useState<ThumbLayout | null>(null)

  const syncThumbs = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const nextH = horizontal
      ? thumbLayout(el.scrollLeft, el.clientWidth, el.scrollWidth)
      : null
    const nextV = vertical
      ? thumbLayout(el.scrollTop, el.clientHeight, el.scrollHeight)
      : null
    hThumbRef.current = nextH
    vThumbRef.current = nextV
    setHThumb(nextH)
    setVThumb(nextV)
  }, [horizontal, vertical])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const viewport = el

    syncThumbs()

    const ro = new ResizeObserver(() => syncThumbs())
    ro.observe(viewport)
    if (viewport.firstElementChild) ro.observe(viewport.firstElementChild)

    function onWheel(event: WheelEvent) {
      if (!horizontal) return

      const remapVerticalToHorizontal = !vertical || event.shiftKey
      if (!remapVerticalToHorizontal) return

      const dx = event.deltaX + (remapVerticalToHorizontal ? event.deltaY : 0)
      if (dx === 0) return

      event.preventDefault()
      viewport.scrollLeft += dx
      syncThumbs()
    }

    viewport.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("resize", syncThumbs)
    return () => {
      ro.disconnect()
      viewport.removeEventListener("wheel", onWheel)
      window.removeEventListener("resize", syncThumbs)
    }
  }, [syncThumbs, children, horizontal, vertical])

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = thumbDragRef.current
      const el = viewportRef.current
      if (!drag || !el || drag.pointerId !== event.pointerId) return

      const maxOffset = Math.max(0, drag.trackSize - drag.thumbSize)
      const delta =
        drag.axis === "y"
          ? event.clientY - drag.startPointer
          : event.clientX - drag.startPointer
      const nextOffset = Math.min(
        maxOffset,
        Math.max(0, drag.startOffset + delta)
      )
      const nextScroll =
        maxOffset <= 0 ? 0 : (nextOffset / maxOffset) * drag.maxScroll

      if (drag.axis === "y") el.scrollTop = nextScroll
      else el.scrollLeft = nextScroll
    }

    function onUp(event: PointerEvent) {
      const drag = thumbDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      thumbDragRef.current = null
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  function onScroll(_event: UIEvent<HTMLDivElement>) {
    syncThumbs()
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Middle mouse only (button === 1)
    if (event.button !== 1) return
    const el = viewportRef.current
    if (!el) return

    event.preventDefault()
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    }
    setPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    const el = viewportRef.current
    if (!pan || !el || pan.pointerId !== event.pointerId) return

    const dx = event.clientX - pan.startX
    const dy = event.clientY - pan.startY
    if (horizontal) el.scrollLeft = pan.scrollLeft - dx
    if (vertical) el.scrollTop = pan.scrollTop - dy
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    panRef.current = null
    setPanning(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  function onAuxClick(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button === 1) event.preventDefault()
  }

  /** Click track → page toward click; click thumb → start drag. */
  function onVerticalTrackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const el = viewportRef.current
    const thumb = vThumbRef.current
    if (!el || !thumb || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const onThumb = y >= thumb.offset && y <= thumb.offset + thumb.size

    if (onThumb) {
      thumbDragRef.current = {
        axis: "y",
        pointerId: event.pointerId,
        startPointer: event.clientY,
        startOffset: thumb.offset,
        thumbSize: thumb.size,
        trackSize: thumb.track,
        maxScroll: el.scrollHeight - el.clientHeight,
      }
      return
    }

    // Page toward the click (native Windows-style track click).
    const page = el.clientHeight * 0.9
    el.scrollTop += y < thumb.offset ? -page : page
  }

  function onHorizontalTrackPointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const el = viewportRef.current
    const thumb = hThumbRef.current
    if (!el || !thumb || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const onThumb = x >= thumb.offset && x <= thumb.offset + thumb.size

    if (onThumb) {
      thumbDragRef.current = {
        axis: "x",
        pointerId: event.pointerId,
        startPointer: event.clientX,
        startOffset: thumb.offset,
        thumbSize: thumb.size,
        trackSize: thumb.track,
        maxScroll: el.scrollWidth - el.clientWidth,
      }
      return
    }

    const page = el.clientWidth * 0.9
    el.scrollLeft += x < thumb.offset ? -page : page
  }

  return (
    <div
      className={cn("relative flex min-h-0 min-w-0 flex-col", className)}
      style={style}
    >
      <div
        ref={viewportRef}
        role="region"
        aria-label={label}
        className={cn(
          "mi-middle-scroll min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain",
          vertical && "pr-3",
          panning ? "cursor-grabbing select-none" : "cursor-default",
          viewportClassName
        )}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onAuxClick={onAuxClick}
      >
        {children}
      </div>

      {horizontal && hThumb ? (
        <div
          className="relative mt-1 h-2 w-full shrink-0 border border-cyan-500/25 bg-black/60"
          onPointerDown={onHorizontalTrackPointerDown}
          aria-hidden
        >
          <div
            className="absolute top-0 h-full cursor-grab bg-cyan-500/55 hover:bg-cyan-400/70 active:cursor-grabbing"
            style={{
              width: hThumb.size,
              left: hThumb.offset,
            }}
          />
        </div>
      ) : null}

      {/* Always paint the vertical track when enabled so the scroll rect is
          visible; the thumb only appears once content overflows. */}
      {vertical ? (
        <div
          className="absolute top-0 right-0 bottom-0 z-10 w-2 border border-cyan-500/25 bg-black/60"
          style={{ bottom: horizontal && hThumb ? 12 : 0 }}
          onPointerDown={onVerticalTrackPointerDown}
          aria-hidden
        >
          {vThumb ? (
            <div
              className="absolute left-0 w-full cursor-grab bg-cyan-500/55 hover:bg-cyan-400/70 active:cursor-grabbing"
              style={{
                height: vThumb.size,
                top: vThumb.offset,
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
