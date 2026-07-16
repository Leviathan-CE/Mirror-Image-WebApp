import { useLayoutEffect, useRef, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const editBoxVariants = cva(
  "terminal-caret clip-angled border bg-black/80 font-mono text-sm text-white outline-none placeholder:text-white/40 disabled:cursor-not-allowed disabled:opacity-50",
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

function measureTextWidth(
  input: HTMLInputElement,
  text: string,
  password: boolean
): number {
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

  mirror.textContent = password ? "•".repeat(text.length) : text || " "
  document.body.appendChild(mirror)
  const textWidth = mirror.getBoundingClientRect().width
  document.body.removeChild(mirror)

  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0
  // Extra room for the block caret + angled clip.
  return Math.ceil(textWidth + paddingLeft + paddingRight + 14)
}

function measureCaretLeft(input: HTMLInputElement, password: boolean): number {
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
  mirror.textContent = password
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
  autoWidth = false,
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
    /** Grow/shrink width to fit the current value (or placeholder). */
    autoWidth?: boolean
  }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [caretLeft, setCaretLeft] = useState(0)
  const [fitWidth, setFitWidth] = useState<number | undefined>()

  const syncCaret = () => {
    const input = inputRef.current
    if (!input) return
    setCaretLeft(measureCaretLeft(input, password))
  }

  const syncAutoWidth = () => {
    const input = inputRef.current
    if (!input || !autoWidth) return
    const sample =
      input.value.length > 0
        ? input.value
        : (props.placeholder as string | undefined) || " "
    const next = measureTextWidth(input, sample, password)
    setFitWidth(Math.max(next, 48))
  }

  useLayoutEffect(() => {
    if (focused) syncCaret()
    if (autoWidth) syncAutoWidth()
  }, [focused, autoWidth, password, props.value, props.defaultValue, props.placeholder])

  return (
    <div
      className={cn(
        "relative",
        autoWidth ? "inline-block max-w-full align-middle" : "w-full"
      )}
    >
      <input
        ref={inputRef}
        data-slot="edit-box"
        type={password ? "password" : type ?? "text"}
        className={cn(
          editBoxVariants({ variant, size }),
          autoWidth ? "min-w-0 max-w-full" : "min-w-100 w-full",
          className
        )}
        style={
          {
            "--angle": "10px",
            ...(autoWidth && fitWidth != null ? { width: fitWidth } : null),
            ...style,
          } as React.CSSProperties
        }
        {...props}
        onFocus={(event) => {
          setFocused(true)
          requestAnimationFrame(() => {
            syncCaret()
            syncAutoWidth()
          })
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        onChange={(event) => {
          syncCaret()
          syncAutoWidth()
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
