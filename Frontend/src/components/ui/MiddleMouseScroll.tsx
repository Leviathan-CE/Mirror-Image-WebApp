/**
 * Custom scrollport with styled scrollbar + middle-mouse drag pan.
 * Wheel up/down pans horizontally when `vertical={false}` (or with Shift when both axes).
 * Middle-button drag still pans like a hand tool.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent,
} from "react"

import { cn } from "@/lib/utils"

export type MiddleMouseScrollProps = {
  children: ReactNode
  className?: string
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
  viewportClassName,
  horizontal = true,
  vertical = true,
  label = "Scrollable area",
}: MiddleMouseScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<PanState | null>(null)
  const [panning, setPanning] = useState(false)
  const [hThumb, setHThumb] = useState<ThumbLayout | null>(null)
  const [vThumb, setVThumb] = useState<ThumbLayout | null>(null)

  const syncThumbs = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setHThumb(
      horizontal
        ? thumbLayout(el.scrollLeft, el.clientWidth, el.scrollWidth)
        : null
    )
    setVThumb(
      vertical
        ? thumbLayout(el.scrollTop, el.clientHeight, el.scrollHeight)
        : null
    )
  }, [horizontal, vertical])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    // Local non-null binding — nested handlers must not close over a value
    // TypeScript still treats as `HTMLDivElement | null` (ref.current is mutable).
    const viewport = el

    syncThumbs()

    const ro = new ResizeObserver(() => syncThumbs())
    ro.observe(viewport)
    if (viewport.firstElementChild) ro.observe(viewport.firstElementChild)

    // Non-passive so we can remap vertical wheel → horizontal scroll.
    function onWheel(event: WheelEvent) {
      if (!horizontal) return

      // Horizontal-only: wheel up/down pans left/right.
      // Both axes + shift: vertical wheel pans horizontally.
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
    // Stop browser autoscroll / default middle-click behavior.
    if (event.button === 1) event.preventDefault()
  }

  function jumpHorizontal(event: ReactPointerEvent<HTMLDivElement>) {
    const el = viewportRef.current
    if (!el || !hThumb || event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth)
  }

  function jumpVertical(event: ReactPointerEvent<HTMLDivElement>) {
    const el = viewportRef.current
    if (!el || !vThumb || event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-col", className)}>
      <div
        ref={viewportRef}
        role="region"
        aria-label={label}
        className={cn(
          "mi-middle-scroll min-h-0 min-w-0 flex-1 overflow-auto",
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
          onPointerDown={jumpHorizontal}
          aria-hidden
        >
          <div
            className="absolute top-0 h-full bg-cyan-500/55 hover:bg-cyan-400/70"
            style={{
              width: hThumb.size,
              left: hThumb.offset,
            }}
          />
        </div>
      ) : null}

      {vertical && vThumb ? (
        <div
          className="absolute top-0 right-0 bottom-0 w-2 border border-cyan-500/25 bg-black/60"
          style={{ bottom: horizontal && hThumb ? 12 : 0 }}
          onPointerDown={jumpVertical}
          aria-hidden
        >
          <div
            className="absolute left-0 w-full bg-cyan-500/55 hover:bg-cyan-400/70"
            style={{
              height: vThumb.size,
              top: vThumb.offset,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
