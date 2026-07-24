/**
 * Generic right-click / cursor-position menu.
 * Controlled: parent opens it at (x, y) and closes via onClose.
 * Renders in a portal so overflow:hidden ancestors do not clip it.
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

  useLayoutEffect(() => {
    if (!open) return
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

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    // Defer so the same right-click that opened the menu does not immediately close it.
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown)
    }, 0)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      className={cn(
        "fixed z-[100] min-w-[9rem] border border-cyan-500/30 bg-black/95 py-1 shadow-lg",
        className
      )}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={cn(
            "font-buahs93 block w-full px-3 py-2 text-left text-xs hover:bg-cyan-500/15 disabled:opacity-50",
            item.tone === "danger"
              ? "text-red-300/90 hover:bg-red-500/15"
              : "text-cyan-100"
          )}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
