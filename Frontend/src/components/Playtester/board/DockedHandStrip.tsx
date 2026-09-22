/**
 * Docked hand strip — sits in the layout under (or above) the field.
 * Not a floating window: no drag-to-move / corner resize; height is fixed
 * by the parent so PlayerHand can size cards from `clientHeight`.
 *
 * Label floats over the card row (no dedicated header chrome) so more of
 * the strip height goes to faces.
 */

import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

export type DockedHandStripProps = {
  panelRef?: Ref<HTMLDivElement | null>
  label: string
  children: ReactNode
  className?: string
  /** Strip height in px (PlayerHand scales cards to fill). */
  heightPx: number
  /** Drop border/fill so only the card slivers show (Arena-style peek). */
  bare?: boolean
  /**
   * Paint the dock as a landing zone. Shown once a drag has picked up a
   * card and this hand is empty. Does not take clicks.
   */
  dropCue?: boolean
}

function placeDropCue(dock: HTMLDivElement, band: HTMLDivElement) {
  const rect = dock.getBoundingClientRect()
  band.style.left = `${rect.left}px`
  band.style.top = `${rect.top}px`
  band.style.width = `${rect.width}px`
  band.style.height = `${rect.height}px`
}

function assignRef(
  ref: Ref<HTMLDivElement | null> | undefined,
  node: HTMLDivElement | null
) {
  if (!ref) return
  if (typeof ref === "function") {
    ref(node)
    return
  }
  ref.current = node
}

export function DockedHandStrip({
  panelRef,
  label,
  children,
  className,
  heightPx,
  bare = false,
  dropCue = false,
}: DockedHandStripProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const cueRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!dropCue) return
    const dock = nodeRef.current
    const band = cueRef.current
    if (!dock) return
    if (!band) return

    const sync = () => {
      placeDropCue(dock, band)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(dock)
    window.addEventListener("resize", sync)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", sync)
    }
  }, [dropCue])

  return (
    <div
      ref={(node) => {
        nodeRef.current = node
        assignRef(panelRef, node)
      }}
      className={cn(
        "relative z-40 flex shrink-0 flex-col overflow-x-hidden overflow-y-visible",
        bare ? "border-0 bg-transparent" : "border border-cyan-500/40 bg-black/80",
        className
      )}
      style={{ height: heightPx }}
    >
      <p
        className="pointer-events-none absolute top-1 left-2 z-20 max-w-[calc(100%-1rem)] truncate font-mono text-[10px] tracking-wide text-cyan-100/80 drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]"
        aria-hidden
      >
        {label}
      </p>
      <span className="sr-only">{label}</span>
      <div className="relative min-h-0 flex-1">{children}</div>
      {dropCue
        ? createPortal(
            <div
              ref={cueRef}
              className="pointer-events-none fixed z-[75] flex items-center justify-center border-2 border-cyan-200 bg-cyan-400/35 shadow-[inset_0_0_24px_rgba(34,211,238,0.45)]"
            >
              <p className="font-mono text-xs tracking-wide text-cyan-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                Drop to hand
              </p>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
