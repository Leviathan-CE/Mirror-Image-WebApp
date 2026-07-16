/**
 * Typeahead card search — pick a hit to add it to the deck (Main).
 */

import { useEffect, useId, useRef, useState } from "react"

import { EditBox } from "@/components/ui/EditBox"
import { searchCards, type CardSearchHit } from "@/lib/api/cards"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

type DeckCardSearchProps = {
  disabled?: boolean
  onPick: (card: CardSearchHit) => void | Promise<void>
  onOpenChange?: (open: boolean) => void
}

export function DeckCardSearch({
  disabled = false,
  onPick,
  onOpenChange,
}: DeckCardSearchProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [busyPick, setBusyPick] = useState(false)

  onOpenChangeRef.current = onOpenChange

  function setMenuOpen(next: boolean) {
    setOpen((prev) => {
      if (prev !== next) onOpenChangeRef.current?.(next)
      return next
    })
  }

  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setHits([])
      setMenuOpen(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchCards(q, 12)
          if (cancelled) return
          setHits(results)
          setActiveIndex(0)
          setMenuOpen(true)
        } catch {
          if (cancelled) return
          setHits([])
          setMenuOpen(true)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  async function choose(hit: CardSearchHit) {
    if (disabled || busyPick) return
    setBusyPick(true)
    try {
      await onPick(hit)
      setQuery("")
      setHits([])
      setMenuOpen(false)
    } finally {
      setBusyPick(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full max-w-xl",
        // Above card stacks (hover uses ~z-50) while the menu is open.
        open && "z-[100]"
      )}
    >
      <label className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
        ADD CARD
      </label>
      <EditBox
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (hits.length > 0) setMenuOpen(true)
        }}
        placeholder="Search cards…"
        size="sm"
        disabled={disabled || busyPick}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onKeyDown={(event) => {
          if (!open || hits.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((i) => (i + 1) % hits.length)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((i) => (i - 1 + hits.length) % hits.length)
          } else if (event.key === "Enter") {
            event.preventDefault()
            const hit = hits[activeIndex]
            if (hit) void choose(hit)
          } else if (event.key === "Escape") {
            setMenuOpen(false)
          }
        }}
      />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-80 overflow-y-auto border border-cyan-500/30 bg-black/95 shadow-lg"
        >
          {loading && hits.length === 0 ? (
            <li className="px-3 py-2 font-mono text-xs text-cyan-300/60">
              Searching…
            </li>
          ) : null}
          {!loading && hits.length === 0 ? (
            <li className="px-3 py-2 font-mono text-xs text-white/40">
              No matches
            </li>
          ) : null}
          {hits.map((hit, index) => {
            const art = cardArtUrl(hit.card_art_path)
            const active = index === activeIndex
            return (
              <li key={hit.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-2 py-1.5 text-left",
                    active ? "bg-cyan-500/20" : "hover:bg-cyan-500/10"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void choose(hit)}
                  disabled={busyPick}
                >
                  {art ? (
                    <img
                      src={art}
                      alt=""
                      className="h-12 w-9 shrink-0 border border-cyan-500/25 object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-9 shrink-0 items-center justify-center border border-dashed border-cyan-500/20 bg-black/60 font-mono text-[8px] text-cyan-500/40">
                      N/A
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-buahs93 text-sm text-white">
                      {hit.card_name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-cyan-400/60">
                      {hit.card_set_name} · {hit.rarity}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
