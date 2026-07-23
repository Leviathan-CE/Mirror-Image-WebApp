/**
 * Controlled tab list — underline/active styling for archive-style pages.
 */

import { useId, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

export type TabItem = {
  id: string
  label: string
  disabled?: boolean
}

type TabsProps = {
  items: TabItem[]
  value: string
  onValueChange: (id: string) => void
  /** Accessible name for the tab list. */
  label?: string
  className?: string
  tabClassName?: string
}

export function Tabs({
  items,
  value,
  onValueChange,
  label = "Tabs",
  className,
  tabClassName,
}: TabsProps) {
  const baseId = useId()

  function focusTabAt(index: number) {
    const el = document.getElementById(`${baseId}-tab-${items[index]?.id}`)
    el?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
    if (enabled.length === 0) return

    const currentPos = enabled.findIndex(({ item }) => item.id === value)
    const start = currentPos >= 0 ? currentPos : 0

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      const next = enabled[(start + 1) % enabled.length]
      onValueChange(next.item.id)
      focusTabAt(next.index)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      const prev = enabled[(start - 1 + enabled.length) % enabled.length]
      onValueChange(prev.item.id)
      focusTabAt(prev.index)
    } else if (event.key === "Home") {
      event.preventDefault()
      onValueChange(enabled[0].item.id)
      focusTabAt(enabled[0].index)
    } else if (event.key === "End") {
      event.preventDefault()
      const last = enabled[enabled.length - 1]
      onValueChange(last.item.id)
      focusTabAt(last.index)
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex flex-wrap gap-1 border-b border-cyan-500/25",
        className
      )}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            id={`${baseId}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={cn(
              "font-buahs93 relative -mb-px border-b-2 px-4 py-2 text-sm tracking-wide transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? "border-cyan-400 text-cyan-200"
                : "border-transparent text-white/45 hover:text-cyan-100/80",
              tabClassName
            )}
            onClick={() => {
              if (!item.disabled) onValueChange(item.id)
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
