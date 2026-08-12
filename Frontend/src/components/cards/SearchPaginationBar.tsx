/**
 * Shared PREV / NEXT controls for card catalogue search.
 * Render once above and once below results — same props, no duplicated logic.
 */

import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const primaryActionClassName =
  "font-buahs93 h-9 rounded-none bg-cyan-700 px-5 text-sm text-white hover:bg-cyan-900 disabled:opacity-60"

const secondaryActionClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-4 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

export type SearchPaginationBarProps = {
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  /** Disable both buttons (e.g. while loading). */
  disabled?: boolean
  /** Optional range / status text on the left (library style). */
  summary?: string
  compact?: boolean
  className?: string
  /**
   * `glitch` — public library / deck panel (GlitchFx).
   * `plain` — admin tables (Button).
   */
  variant?: "glitch" | "plain"
}

export function SearchPaginationBar({
  canPrev,
  canNext,
  onPrev,
  onNext,
  disabled = false,
  summary,
  compact = false,
  className,
  variant = "glitch",
}: SearchPaginationBarProps) {
  const prevDisabled = !canPrev || disabled
  const nextDisabled = !canNext || disabled

  if (variant === "plain") {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        <Button
          type="button"
          className={secondaryActionClassName}
          disabled={prevDisabled}
          onClick={onPrev}
        >
          PREV
        </Button>
        {summary ? (
          <p className="font-mono text-xs text-cyan-300/70">{summary}</p>
        ) : null}
        <Button
          type="button"
          className={secondaryActionClassName}
          disabled={nextDisabled}
          onClick={onNext}
        >
          NEXT
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        className
      )}
    >
      {summary != null ? (
        <p className="font-mono text-xs text-cyan-300/70">{summary}</p>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <GlitchFx
          type="button"
          label="PREV"
          disabled={prevDisabled}
          className={cn(secondaryActionClassName, compact && "px-3 text-xs")}
          onClick={onPrev}
        />
        <GlitchFx
          type="button"
          label="NEXT"
          disabled={nextDisabled}
          className={cn(primaryActionClassName, compact && "px-3 text-xs")}
          onClick={onNext}
        />
      </div>
    </div>
  )
}
