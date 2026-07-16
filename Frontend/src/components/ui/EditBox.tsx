import { useLayoutEffect, useRef, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const editBoxVariants = cva(
  "terminal-caret clip-angled min-w-100 border bg-black/80 font-mono text-sm text-white outline-none placeholder:text-white/40 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-white/60 focus-visible:border-white",
        muted: "border-white/40 focus-visible:border-white/70",
      },
      size: {
        default: "h-10 px-3 py-2",
        sm: "h-8 px-2.5 py-1.5 text-xs",
        lg: "h-12 px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function measureCaretLeft(input: HTMLInputElement): number {
  const position = input.selectionStart ?? 0
  const styles = getComputedStyle(input)
  const mirror = document.createElement("span")

  mirror.style.cssText = [
    "position: absolute",
    "visibility: hidden",
    "white-space: pre",
    `font: ${styles.font}`,
    `letter-spacing: ${styles.letterSpacing}`,
    `text-transform: ${styles.textTransform}`,
  ].join(";")

  // Password fields mask glyphs; measure bullets so the caret lines up.
  mirror.textContent =
    input.type === "password"
      ? "•".repeat(position)
      : input.value.slice(0, position)
  document.body.appendChild(mirror)
  const textWidth = mirror.getBoundingClientRect().width
  document.body.removeChild(mirror)

  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
  return paddingLeft + textWidth - input.scrollLeft
}

function EditBox({
  className,
  variant = "default",
  size = "default",
  password = false,
  style,
  type,
  onFocus,
  onBlur,
  onChange,
  onKeyUp,
  onClick,
  onSelect,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof editBoxVariants> & {
    /** When true, masks typed characters (native password input). */
    password?: boolean
  }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [caretLeft, setCaretLeft] = useState(0)

  const syncCaret = () => {
    const input = inputRef.current
    if (!input) return
    setCaretLeft(measureCaretLeft(input))
  }

  useLayoutEffect(() => {
    if (focused) syncCaret()
  }, [focused, props.value, props.defaultValue])

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        data-slot="edit-box"
        type={password ? "password" : type ?? "text"}
        className={cn(editBoxVariants({ variant, size, className }))}
        style={{ "--angle": "10px", ...style } as React.CSSProperties}
        {...props}
        onFocus={(event) => {
          setFocused(true)
          requestAnimationFrame(syncCaret)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        onChange={(event) => {
          syncCaret()
          onChange?.(event)
        }}
        onKeyUp={(event) => {
          syncCaret()
          onKeyUp?.(event)
        }}
        onClick={(event) => {
          syncCaret()
          onClick?.(event)
        }}
        onSelect={(event) => {
          syncCaret()
          onSelect?.(event)
        }}
      />
      {focused ? (
        <span
          aria-hidden
          className="terminal-caret-block pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: caretLeft }}
        />
      ) : null}
    </div>
  )
}

export { EditBox, editBoxVariants }
