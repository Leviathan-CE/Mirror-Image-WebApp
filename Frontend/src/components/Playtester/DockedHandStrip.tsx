/**
 * Docked hand strip — sits in the layout under (or above) the field.
 * Not a floating window: no drag-to-move / corner resize; height is fixed
 * by the parent so PlayerHand can size cards from `clientHeight`.
 *
 * Label floats over the card row (no dedicated header chrome) so more of
 * the strip height goes to faces.
 */

import { type ReactNode, type Ref } from "react"

import { cn } from "@/lib/utils"

export type DockedHandStripProps = {
  panelRef?: Ref<HTMLDivElement | null>
  label: string
  children: ReactNode
  className?: string
  /** Strip height in px (PlayerHand scales cards to fill). */
  heightPx: number
}

export function DockedHandStrip({
  panelRef,
  label,
  children,
  className,
  heightPx,
}: DockedHandStripProps) {
  return (
    <div
      ref={panelRef}
      className={cn(
        "relative z-40 flex shrink-0 flex-col overflow-hidden border border-cyan-500/40 bg-black/80",
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
    </div>
  )
}
