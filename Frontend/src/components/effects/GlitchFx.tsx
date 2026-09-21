import type { CSSProperties, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type GlitchFxProps = React.ComponentProps<typeof Button> & {
  label: string
  /** Icon or other node shown before the label. */
  leading?: ReactNode
  /** Icon or other node shown after the label. */
  trailing?: ReactNode
  /** Extra classes on the outer `.glitch-fx` (colors, CSS vars). */
  fxClassName?: string
  /** Add `clip-angled` (or any shape class) to the inner button. */
  shapeClassName?: string
  /** Corner cut size when using `clip-angled` (e.g. "24px"). */
  angle?: string
}

/**
 * Wraps a Button so the glitch overlay lives on an OUTER element (not clipped)
 * while the inner button can keep an angled/clipped shape.
 */
export function GlitchFx({
  label,
  leading,
  trailing,
  fxClassName,
  className,
  shapeClassName = "clip-angled",
  angle,
  style,
  ...props
}: GlitchFxProps) {
  const hasAddon = Boolean(leading || trailing)

  return (
    <span className={cn("glitch-fx", fxClassName)} data-text={label}>
      <Button
        className={cn(shapeClassName, className)}
        style={
          angle
            ? ({ ...style, "--angle": angle } as CSSProperties)
            : style
        }
        {...props}
      >
        {hasAddon ? (
          <span className="inline-flex items-center gap-2">
            {leading}
            {label}
            {trailing}
          </span>
        ) : (
          label
        )}
      </Button>
    </span>
  )
}
