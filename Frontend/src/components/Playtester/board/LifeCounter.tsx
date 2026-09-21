/**
 * VP tracker beside the pilot — left-click +1, right-click −1.
 * Shows `actual/total` plus the VP icon (rules: start at 0, win at the
 * victory number printed on the pilot).
 */

import { GameIcon } from "@/components/common/GameIcon"
import { cn } from "@/lib/utils"

export type LifeCounterProps = {
  current: number
  total: number
  onAdjust: (delta: number) => void
  className?: string
}

export function LifeCounter({
  current,
  total,
  onAdjust,
  className,
}: LifeCounterProps) {
  const actual = Math.max(0, Math.floor(current))
  const goal = Math.max(0, Math.floor(total))
  return (
    <button
      type="button"
      title={`VP: ${actual}/${goal} · left-click +1 · right-click −1`}
      className={cn(
        "inline-flex min-h-12 min-w-16 select-none items-center justify-center gap-1.5",
        "border border-orange-400/70 bg-orange-950/90 px-2 py-1.5",
        "font-glitch text-xl leading-none text-orange-200",
        "cursor-pointer hover:bg-orange-900/90",
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
      <span>
        {actual}/{goal}
      </span>
      <GameIcon name="vp" className="h-6 w-auto lg:h-6 2xl:h-6" />
    </button>
  )
}
