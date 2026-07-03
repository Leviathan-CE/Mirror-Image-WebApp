import type { CSSProperties } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type GlitchFxProps = React.ComponentProps<typeof Button> & {
  label: string
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
  className,
  shapeClassName = "clip-angled",
  angle,
  style,
  ...props
}: GlitchFxProps) {
  return (
    <span className="glitch-fx" data-text={label}>
      <Button
        className={cn(shapeClassName, className)}
        style={
          angle
            ? ({ ...style, "--angle": angle } as CSSProperties)
            : style
        }
        {...props}
      >
        {label}
      </Button>
    </span>
  )
}
