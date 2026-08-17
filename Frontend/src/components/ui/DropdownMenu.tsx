/**
 * Reusable ⋯ / actions dropdown — click-outside + Escape to close.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

export type DropdownMenuItem = {
  id: string
  /** Plain text or JSX (e.g. text + GameIcon). */
  label: ReactNode
  /** Required for leaf items; omit when `submenu` is present. */
  onSelect?: () => void
  disabled?: boolean
  /** Danger styling (e.g. Delete). */
  tone?: "default" | "danger"
  /** Nested choices — opens a flyout instead of running onSelect. */
  submenu?: DropdownMenuItem[]
  /**
   * Optional count field beside the action (e.g. Degrade [3]).
   * Clicking the action label still runs `onSelect`.
   */
  countInput?: {
    value: string
    onChange: (value: string) => void
    min?: number
    max?: number
    ariaLabel?: string
    /**
     * Locks the field itself, separately from the row. Defaults to the row's
     * `disabled` — pass it explicitly whenever the row is disabled *because of*
     * this value (empty, out of range), or clearing the field would disable the
     * only control that can fix it.
     */
    disabled?: boolean
  }
  /**
   * Free-text field beside the action (e.g. Join [room code]).
   * Enter in the field runs `onSelect`, same as clicking the label.
   */
  textInput?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    ariaLabel?: string
    /** Display and submit the value upper-cased (room codes). */
    uppercase?: boolean
    disabled?: boolean
  }
}

type DropdownMenuProps = {
  /** Accessible name for the trigger button. */
  label: string
  items: DropdownMenuItem[]
  disabled?: boolean
  /** Menu panel horizontal alignment relative to the trigger. */
  align?: "left" | "right"
  /** Optional custom trigger content (defaults to ⋯). */
  trigger?: ReactNode
  className?: string
  triggerClassName?: string
  menuClassName?: string
}

export function DropdownMenu({
  label,
  items,
  disabled = false,
  align = "left",
  trigger = "⋯",
  className,
  triggerClassName,
  menuClassName,
}: DropdownMenuProps) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        className={cn(
          "font-buahs93 flex h-8 w-8 items-center justify-center rounded-none",
          "text-lg leading-none text-cyan-200/80 hover:bg-cyan-500/10 hover:text-white",
          "disabled:opacity-50",
          triggerClassName
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute top-full z-20 mt-1 min-w-[9rem] border border-cyan-500/30 bg-black/95 py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
            menuClassName
          )}
        >
          {items.map((item) => {
            const textInput = item.textInput

            return (
              <div
                key={item.id}
                className={cn(
                  "flex w-full items-center gap-1",
                  textInput ? "px-2 py-1" : undefined
                )}
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cn(
                    "font-buahs93 flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs hover:bg-cyan-500/15 disabled:opacity-50",
                    textInput ? "px-1.5 py-1.5" : "px-3 py-2",
                    item.tone === "danger"
                      ? "text-red-300/90 hover:bg-red-500/15"
                      : "text-cyan-100"
                  )}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect?.()
                  }}
                >
                  {item.label}
                </button>

                {textInput ? (
                  <input
                    type="text"
                    value={textInput.value}
                    placeholder={textInput.placeholder}
                    aria-label={textInput.ariaLabel ?? String(item.label)}
                    disabled={textInput.disabled ?? item.disabled}
                    className={cn(
                      "h-7 w-20 shrink-0 border border-cyan-500/40 bg-black/80 px-1.5",
                      "font-mono text-xs text-cyan-50 outline-none",
                      "focus:border-cyan-300 disabled:opacity-50",
                      textInput.uppercase ? "uppercase" : undefined
                    )}
                    onChange={(event) =>
                      textInput.onChange(
                        textInput.uppercase
                          ? event.target.value.toUpperCase()
                          : event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      event.preventDefault()
                      if (item.disabled) return
                      setOpen(false)
                      item.onSelect?.()
                    }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
