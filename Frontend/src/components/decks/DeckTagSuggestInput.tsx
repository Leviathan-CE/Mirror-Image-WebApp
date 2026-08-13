/**
 * Tag typeahead — closest-name suggestions while the owner types.
 * Layout: input + sibling button share one row (same height).
 */

import { useEffect, useId, useRef, useState } from "react"

import { EditBox } from "@/components/ui/EditBox"
import {
  fetchDeckTagSuggestions,
  type DeckTagSuggestion,
} from "@/lib/api/decks"
import { containsProfanity } from "@/lib/profanity"
import { cn } from "@/lib/utils"

/**
 * Capitalize the first letter of the tag and of each word after a space.
 * Other characters are left as typed (so "mid-range" stays Mid-range).
 */
export function titleCaseTagWords(raw: string): string {
  return raw.replace(/(^| )([a-zA-Z])/g, (_, space: string, ch: string) => {
    return space + ch.toUpperCase()
  })
}

type DeckTagSuggestInputProps = {
  value: string
  onChange: (value: string) => void
  /** Tags already on this deck — hidden from the menu. */
  exclude?: string[]
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Called when the user picks a suggestion (parent usually adds the tag). */
  onPick?: (tag: string) => void
}

export function DeckTagSuggestInput({
  value,
  onChange,
  exclude = [],
  disabled = false,
  placeholder = "Add tag…",
  className,
  onPick,
}: DeckTagSuggestInputProps) {
  const listId = useId()
  const inputId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [hits, setHits] = useState<DeckTagSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 1) {
      setHits([])
      setOpen(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await fetchDeckTagSuggestions({
            q,
            limit: 12,
            exclude,
          })
          if (cancelled) return
          setHits(results)
          setActiveIndex(0)
          setOpen(true)
        } catch {
          if (cancelled) return
          setHits([])
          setOpen(true)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // exclude joined so array identity churn doesn't spam requests
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, exclude.join("\0")])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  function choose(tag: string) {
    const next = titleCaseTagWords(tag.trim())
    if (!next || containsProfanity(next)) return
    onChange(next)
    setOpen(false)
    onPick?.(next)
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <EditBox
        id={inputId}
        value={value}
        onChange={(e) => {
          onChange(titleCaseTagWords(e.target.value))
        }}
        className={cn(
          "w-full",
          containsProfanity(value) &&
            "border-red-400/80 focus-visible:border-red-300"
        )}
        aria-invalid={containsProfanity(value) || undefined}
        onFocus={() => {
          if (value.trim().length > 0) setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false)
            return
          }
          if (event.key === "ArrowDown") {
            if (!open || hits.length === 0) return
            event.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, hits.length - 1))
            return
          }
          if (event.key === "ArrowUp") {
            if (!open || hits.length === 0) return
            event.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
            return
          }
          if (event.key === "Enter") {
            event.preventDefault()
            // Prefer the highlighted suggestion when the menu is open;
            // otherwise commit whatever the user typed (same as ADD TAG).
            if (open && hits.length > 0 && hits[activeIndex]) {
              choose(hits[activeIndex].tag)
              return
            }
            const next = value.trim()
            if (next) choose(next)
          }
        }}
        placeholder={placeholder}
        size="sm"
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />

      {open && value.trim().length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-auto border border-cyan-500/35 bg-black/95 shadow-lg"
        >
          {loading && hits.length === 0 ? (
            <li className="px-3 py-2 font-mono text-[11px] text-white/45">
              Searching tags…
            </li>
          ) : null}
          {hits.map((hit, index) => (
            <li key={hit.tag} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-xs",
                  index === activeIndex
                    ? "bg-cyan-500/20 text-cyan-50"
                    : "text-cyan-100/90 hover:bg-cyan-500/10"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(hit.tag)}
              >
                <span>{hit.tag}</span>
                <span className="shrink-0 text-[10px] text-white/40">
                  {hit.uses}×
                </span>
              </button>
            </li>
          ))}
          {!loading && hits.length === 0 ? (
            <li className="px-3 py-2 font-mono text-[11px] text-white/45">
              No matching tags — add as new
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
