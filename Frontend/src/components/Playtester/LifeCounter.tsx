/**
 * Player life total — left-click +1, right-click −1 (same gesture as card counters).
 */

import { cn } from "@/lib/utils"

export type LifeCounterProps = {
  life: number
  onAdjust: (delta: number) => void
  className?: string
}

export function LifeCounter({ life, onAdjust, className }: LifeCounterProps) {
  return (
    <button
      type="button"
      title={`Life: ${life} · left-click +1 · right-click −1`}
      className={cn(
        "inline-flex min-h-12 w-full select-none items-center justify-center border border-red-400/70",
        "bg-red-950/90 px-3 py-1.5 font-glitch text-3xl leading-none text-red-200",
        "cursor-pointer hover:bg-red-900/90",
        className
      )}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onAdjust(1)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onAdjust(-1)
      }}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {life}
    </button>
  )
}
