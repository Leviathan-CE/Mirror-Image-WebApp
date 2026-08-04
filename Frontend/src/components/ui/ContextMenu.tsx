/**
 * Generic right-click / cursor-position menu.
 * Controlled: parent opens it at (x, y) and closes via onClose.
 * Renders in a portal so overflow:hidden ancestors do not clip it.
 * Items may declare `submenu` for a nested flyout.
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import type { DropdownMenuItem } from "@/components/ui/DropdownMenu"
import { cn } from "@/lib/utils"

export type ContextMenuProps = {
  open: boolean
  /** Viewport X (usually event.clientX). */
  x: number
  /** Viewport Y (usually event.clientY). */
  y: number
  items: DropdownMenuItem[]
  onClose: () => void
  /** Accessible name for the menu. */
  label?: string
  className?: string
}

const VIEWPORT_PAD = 8

export function ContextMenu({
  open,
  x,
  y,
  items,
  onClose,
  label = "Context menu",
  className,
}: ContextMenuProps) {
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setOpenSubmenuId(null)
      return
    }
    const el = menuRef.current
    if (!el) {
      setPos({ left: x, top: y })
      return
    }

    const { width, height } = el.getBoundingClientRect()
    const maxLeft = window.innerWidth - width - VIEWPORT_PAD
    const maxTop = window.innerHeight - height - VIEWPORT_PAD
    setPos({
      left: Math.max(VIEWPORT_PAD, Math.min(x, maxLeft)),
      top: Math.max(VIEWPORT_PAD, Math.min(y, maxTop)),
    })
  }, [open, x, y, items.length])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (openSubmenuId) {
        setOpenSubmenuId(null)
        return
      }
      onClose()
    }

    // Capture phase: zone cards call stopPropagation on pointerdown, so a
    // bubble-only listener on document would never see outside clicks.
    // Defer so the same right-click that opened the menu does not close it.
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true)
    }, 0)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose, openSubmenuId])

  if (!open || typeof document === "undefined") return null

  function runLeaf(item: DropdownMenuItem) {
    onClose()
    if (item.disabled) return
    queueMicrotask(() => item.onSelect?.())
  }

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      className={cn(
        "fixed z-[10100] min-w-[9rem] border border-cyan-500/30 bg-black/95 py-1 shadow-lg",
        className
      )}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => {
        const hasSubmenu = Boolean(item.submenu?.length)
        const submenuOpen = openSubmenuId === item.id
        const countInput = item.countInput

        return (
          <div key={item.id} className="relative">
            <div
              className={cn(
                "flex w-full items-center gap-1",
                countInput ? "px-2 py-1" : undefined
              )}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup={hasSubmenu ? "menu" : undefined}
                aria-expanded={hasSubmenu ? submenuOpen : undefined}
                disabled={item.disabled}
                className={cn(
                  "font-buahs93 flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs hover:bg-cyan-500/15 disabled:opacity-50",
                  countInput ? "px-1.5 py-1.5" : "px-3 py-2",
                  item.tone === "danger"
                    ? "text-red-300/90 hover:bg-red-500/15"
                    : "text-cyan-100"
                )}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (item.disabled) {
                    onClose()
                    return
                  }
                  if (hasSubmenu) {
                    setOpenSubmenuId((prev) =>
                      prev === item.id ? null : item.id
                    )
                    return
                  }
                  runLeaf(item)
                }}
              >
                <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                  {item.label}
                </span>
                {hasSubmenu ? (
                  <span className="shrink-0 text-cyan-300/70" aria-hidden>
                    ›
                  </span>
                ) : null}
              </button>

              {countInput ? (
                <input
                  type="number"
                  inputMode="numeric"
                  min={countInput.min ?? 1}
                  max={countInput.max}
                  value={countInput.value}
                  aria-label={countInput.ariaLabel ?? `${String(item.label)} count`}
                  disabled={countInput.disabled ?? item.disabled}
                  className={cn(
                    "h-7 w-12 shrink-0 border border-cyan-500/40 bg-black/80 px-1",
                    "font-mono text-xs text-cyan-50 outline-none",
                    "focus:border-cyan-300 disabled:opacity-50"
                  )}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => countInput.onChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      event.stopPropagation()
                      if (!item.disabled) runLeaf(item)
                    }
                  }}
                />
              ) : null}
            </div>

            {hasSubmenu && submenuOpen ? (
              <div
                role="menu"
                className="absolute top-0 left-full z-10 ml-1 min-w-[9rem] border border-cyan-500/30 bg-black/95 py-1 shadow-lg"
              >
                {item.submenu!.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    role="menuitem"
                    disabled={sub.disabled}
                    className={cn(
                      "font-buahs93 inline-flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs hover:bg-cyan-500/15 disabled:opacity-50",
                      sub.tone === "danger"
                        ? "text-red-300/90 hover:bg-red-500/15"
                        : "text-cyan-100"
                    )}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      runLeaf(sub)
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>,
    document.body
  )
}
