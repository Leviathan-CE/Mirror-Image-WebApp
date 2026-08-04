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
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "font-buahs93 flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs hover:bg-cyan-500/15 disabled:opacity-50",
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
          ))}
        </div>
      ) : null}
    </div>
  )
}
