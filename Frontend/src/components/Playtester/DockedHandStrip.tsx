/**
 * Docked hand strip — sits in the layout under (or above) the field.
 * Not a floating window: no drag-to-move / corner resize; height is fixed
 * by the parent so PlayerHand can size cards from `clientHeight`.
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
        "z-40 flex shrink-0 flex-col overflow-hidden border border-cyan-500/40 bg-black/80",
        className
      )}
      style={{ height: heightPx }}
    >
      <div className="flex shrink-0 items-center border-b border-cyan-500/25 px-2 py-1">
        <p className="min-w-0 truncate font-mono text-[10px] tracking-wide text-cyan-100/80">
          {label}
        </p>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  )
}
