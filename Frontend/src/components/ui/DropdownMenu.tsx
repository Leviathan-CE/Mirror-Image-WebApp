/**
 * Reusable ⋯ / actions dropdown — click-outside + Escape to close.
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

export type DropdownMenuItem = {
  id: string
  /** Visual divider — omit label / onSelect. */
  separator?: boolean
  /** Plain text or JSX (e.g. text + GameIcon). */
  label?: ReactNode
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (!open) return

    function placeMenu() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const next: CSSProperties = {
        position: "fixed",
        top: rect.bottom + 4,
        zIndex: 80,
      }
      if (align === "right") {
        next.right = window.innerWidth - rect.right
      } else {
        next.left = rect.left
      }
      setMenuStyle(next)
    }

    placeMenu()
    window.addEventListener("resize", placeMenu)
    window.addEventListener("scroll", placeMenu, true)
    return () => {
      window.removeEventListener("resize", placeMenu)
      window.removeEventListener("scroll", placeMenu, true)
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
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

  const menuPanel =
    open && typeof document !== "undefined" ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        style={menuStyle}
        className={cn(
          "min-w-[9rem] border border-cyan-500/30 bg-black/95 py-1 shadow-lg",
          menuClassName
        )}
      >
          {items.map((item) => {
            if (item.separator) {
              return (
                <div
                  key={item.id}
                  role="separator"
                  className="my-1 border-t border-cyan-500/25"
                />
              )
            }
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
    ) : null

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
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
      {menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  )
}
