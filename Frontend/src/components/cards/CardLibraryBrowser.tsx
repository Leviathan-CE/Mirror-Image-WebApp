/**
 * Reusable card library browser — search + filters + art grid.
 * Used full-page on /cards and as a compact side panel on the deck editor.
 */

import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react"

import { CardDetailOverlay } from "@/components/cards/CardDetailOverlay"
import { costTokenToIcon } from "@/components/cards/CardCostIcons"
import { CardSearchBar } from "@/components/cards/CardSearchBar"
import { GameIcon } from "@/components/common/GameIcon"
import {
  beginDeckCardDrag,
  DECK_CARD_DRAG_MIME,
  endDeckCardDrag,
  LIBRARY_DRAG_CATEGORY_ID,
  type DeckCardDragPayload,
} from "@/components/decks/DeckCardStack"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import { ApiError } from "@/lib/api/client"
import {
  fetchCardFacets,
  fetchCardLibrary,
  type CardLibraryFacets,
  type CardLibraryItem,
} from "@/lib/api/cards"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const PAGE_SIZE_FULL = 48
const PAGE_SIZE_COMPACT = 24

const primaryActionClassName =
  "font-buahs93 h-9 rounded-none bg-cyan-700 px-5 text-sm text-white hover:bg-cyan-900 disabled:opacity-60"

const secondaryActionClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-4 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

const filterSelectClassName =
  "h-9 w-full rounded-none border border-cyan-500/35 bg-black/80 px-2.5 font-mono text-xs text-cyan-50 outline-none focus-visible:border-cyan-300"

const EMPTY_FACETS: CardLibraryFacets = {
  colors: ["LIF", "MET", "POW", "RAM", "TIM", "STL"],
  super_types: [],
  sub_types: [],
  types_lines: [],
  invoke_cost_min: 0,
  invoke_cost_max: 15,
}

export type CardLibraryBrowserProps = {
  token?: string | null
  /** Tighter filters + denser grid for the deck side panel. */
  compact?: boolean
  /** Enable HTML5 drag with library sentinel payload (deck editor). */
  draggable?: boolean
  className?: string
  /** Optional heading above filters (compact panel). */
  title?: string
  /**
   * When set (deck editor): left-click adds the card.
   * Detail zoom moves to right-click. Without this, left-click opens detail.
   */
  onCardActivate?: (card: CardLibraryItem) => void | Promise<void>
}

export function CardLibraryBrowser({
  token = null,
  compact = false,
  draggable = false,
  className,
  title,
  onCardActivate,
}: CardLibraryBrowserProps) {
  const pageSize = compact ? PAGE_SIZE_COMPACT : PAGE_SIZE_FULL
  const suppressClickRef = useRef(false)
  const [facets, setFacets] = useState<CardLibraryFacets>(EMPTY_FACETS)
  const [items, setItems] = useState<CardLibraryItem[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorText, setErrorText] = useState("")

  const [nameQuery, setNameQuery] = useState("")
  const [debouncedName, setDebouncedName] = useState("")
  const [descriptionQuery, setDescriptionQuery] = useState("")
  const [debouncedDescription, setDebouncedDescription] = useState("")
  const [colors, setColors] = useState<string[]>([])
  const [invokeMin, setInvokeMin] = useState("")
  const [invokeMax, setInvokeMax] = useState("")
  const [typesLine, setTypesLine] = useState("")
  const [superType, setSuperType] = useState("")
  const [subType, setSubType] = useState("")
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<CardLibraryItem | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedName(nameQuery.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [nameQuery])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedDescription(descriptionQuery.trim()),
      200
    )
    return () => window.clearTimeout(timer)
  }, [descriptionQuery])

  useEffect(() => {
    let cancelled = false
    fetchCardFacets(token)
      .then((data) => {
        if (!cancelled) setFacets(data)
      })
      .catch(() => {
        /* keep EMPTY_FACETS fallback */
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    setOffset(0)
  }, [
    debouncedName,
    debouncedDescription,
    colors,
    invokeMin,
    invokeMax,
    typesLine,
    superType,
    subType,
    pageSize,
  ])

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setErrorText("")

    const min =
      invokeMin.trim() === "" ? null : Number.parseInt(invokeMin, 10)
    const max =
      invokeMax.trim() === "" ? null : Number.parseInt(invokeMax, 10)

    void fetchCardLibrary(
      {
        q: debouncedName || undefined,
        description: debouncedDescription || undefined,
        colors,
        invokeCostMin: Number.isFinite(min) ? min : null,
        invokeCostMax: Number.isFinite(max) ? max : null,
        typesLine: typesLine || undefined,
        superType: superType || undefined,
        subType: subType || undefined,
        limit: pageSize,
        offset,
      },
      token
    )
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setTotal(result.total)
        setStatus("ready")
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStatus("error")
        setItems([])
        setTotal(0)
        setErrorText(
          error instanceof ApiError
            ? "Could not load the card library."
            : "Could not reach the server."
        )
      })

    return () => {
      cancelled = true
    }
  }, [
    debouncedName,
    debouncedDescription,
    colors,
    invokeMin,
    invokeMax,
    typesLine,
    superType,
    subType,
    offset,
    token,
    pageSize,
  ])

  function toggleColor(color: string) {
    setColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    )
  }

  function clearFilters() {
    setNameQuery("")
    setDescriptionQuery("")
    setColors([])
    setInvokeMin("")
    setInvokeMax("")
    setTypesLine("")
    setSuperType("")
    setSubType("")
    setOffset(0)
  }

  function onLibraryDragStart(
    event: ReactDragEvent<HTMLButtonElement>,
    card: CardLibraryItem
  ) {
    if (!draggable) {
      event.preventDefault()
      return
    }
    suppressClickRef.current = true
    const payload: DeckCardDragPayload = {
      cardId: card.id,
      fromCategoryId: LIBRARY_DRAG_CATEGORY_ID,
    }
    beginDeckCardDrag(payload)
    const encoded = JSON.stringify(payload)
    event.dataTransfer.setData(DECK_CARD_DRAG_MIME, encoded)
    event.dataTransfer.setData("text/plain", encoded)
    event.dataTransfer.effectAllowed = "copy"
  }

  function onCardButtonClick(card: CardLibraryItem) {
    if (suppressClickRef.current) return
    if (onCardActivate) {
      void onCardActivate(card)
      return
    }
    setSelected(card)
  }

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + items.length, total)
  const canPrev = offset > 0
  const canNext = offset + pageSize < total
  const advancedActive =
    descriptionQuery.trim() !== "" ||
    invokeMin.trim() !== "" ||
    invokeMax.trim() !== "" ||
    typesLine !== "" ||
    superType !== "" ||
    subType !== ""

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {title ? (
        <header className={cn("mb-3", compact && "border-b border-cyan-500/20 pb-2")}>
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ARCHIVE
          </p>
          <h2
            className={cn(
              "font-glitch text-cyan-300",
              compact ? "mt-0.5 text-xl" : "mt-1 text-3xl"
            )}
          >
            {title}
          </h2>
          {onCardActivate ? (
            <p className="mt-1 font-mono text-[10px] text-white/45">
              Click to add · middle/right-click for details
              {draggable ? " · drag onto a section" : ""}
            </p>
          ) : draggable ? (
            <p className="mt-1 font-mono text-[10px] text-white/45">
              Drag a card onto a deck section to add it.
            </p>
          ) : null}
        </header>
      ) : null}

      <div
        className={cn(
          "mb-4 border border-cyan-500/25 bg-black/55",
          compact ? "space-y-3 p-3" : "mb-6 grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_14rem]"
        )}
      >
        <div className="space-y-3">
          <CardSearchBar
            label="NAME"
            value={nameQuery}
            onChange={setNameQuery}
            placeholder="Closest name match…"
          />

          <div>
            <button
              type="button"
              aria-expanded={advancedOpen}
              className={cn(
                "flex w-full items-center justify-between border border-cyan-500/30 bg-black/60 px-3 py-2",
                "font-buahs93 text-xs tracking-wide text-cyan-100 hover:border-cyan-400/50 hover:bg-cyan-500/10"
              )}
              onClick={() => setAdvancedOpen((prev) => !prev)}
            >
              <span className="inline-flex items-center gap-2">
                ADVANCED SEARCH
                {advancedActive ? (
                  <span
                    className="inline-block size-1.5 rounded-full bg-cyan-400"
                    title="Filters active"
                    aria-label="Advanced filters active"
                  />
                ) : null}
              </span>
              <span className="font-mono text-[10px] text-cyan-300/70">
                {advancedOpen ? "▲" : "▼"}
              </span>
            </button>

            {advancedOpen ? (
              <div
                className={cn(
                  "mt-2 grid gap-3 border border-cyan-500/20 border-t-0 bg-black/40 p-3",
                  !compact && "sm:grid-cols-2"
                )}
              >
                <label className={cn("block", !compact && "sm:col-span-2")}>
                  <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                    DESCRIPTION
                  </span>
                  <EditBox
                    value={descriptionQuery}
                    onChange={(e) => setDescriptionQuery(e.target.value)}
                    placeholder={
                      compact ? "Rules text…" : "Rules text contains…"
                    }
                    size="sm"
                    autoComplete="off"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                    INVOKE MIN
                  </span>
                  <EditBox
                    value={invokeMin}
                    onChange={(e) =>
                      setInvokeMin(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder={`${facets.invoke_cost_min}`}
                    size="sm"
                    inputMode="numeric"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                    INVOKE MAX
                  </span>
                  <EditBox
                    value={invokeMax}
                    onChange={(e) =>
                      setInvokeMax(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder={`${facets.invoke_cost_max}`}
                    size="sm"
                    inputMode="numeric"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                    TYPE LINE
                  </span>
                  <select
                    value={typesLine}
                    onChange={(e) => setTypesLine(e.target.value)}
                    className={filterSelectClassName}
                  >
                    <option value="">Any</option>
                    {facets.types_lines.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                    SUPER TYPE
                  </span>
                  <select
                    value={superType}
                    onChange={(e) => setSuperType(e.target.value)}
                    className={filterSelectClassName}
                  >
                    <option value="">Any</option>
                    {facets.super_types.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={cn("block", !compact && "sm:col-span-2")}>
                  <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                    SUB TYPE
                  </span>
                  <select
                    value={subType}
                    onChange={(e) => setSubType(e.target.value)}
                    className={filterSelectClassName}
                  >
                    <option value="">Any</option>
                    {facets.sub_types.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 font-buahs93 text-xs text-cyan-200/70">COLOR COST</p>
          <div className="grid w-fit grid-cols-3 gap-2">
            {facets.colors.map((color) => {
              const on = colors.includes(color)
              const icon = costTokenToIcon(color)
              return (
                <Button
                  key={color}
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-pressed={on}
                  aria-label={`Filter ${color}`}
                  title={color}
                  className={cn(
                    "size-9 rounded-none border",
                    on
                      ? "border-cyan-400 bg-cyan-700 hover:bg-cyan-800"
                      : "border-cyan-500/40 bg-black/70 hover:border-cyan-400/70 hover:bg-cyan-500/10"
                  )}
                  onClick={() => toggleColor(color)}
                >
                  {icon ? (
                    <GameIcon
                      name={icon}
                      className="h-5 w-auto lg:h-5 2xl:h-5"
                    />
                  ) : (
                    <span className="font-buahs93 text-[10px] text-cyan-100">
                      {color}
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
          <GlitchFx
            type="button"
            label="CLEAR FILTERS"
            className={cn(
              secondaryActionClassName,
              compact ? "mt-3 w-full px-2 text-xs" : "mt-4"
            )}
            onClick={clearFilters}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-cyan-300/70">
          {status === "loading"
            ? "Scanning archive…"
            : `${pageStart}–${pageEnd} of ${total}`}
        </p>
        <div className="flex gap-2">
          <GlitchFx
            type="button"
            label="PREV"
            disabled={!canPrev || status === "loading"}
            className={cn(secondaryActionClassName, compact && "px-3 text-xs")}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          />
          <GlitchFx
            type="button"
            label="NEXT"
            disabled={!canNext || status === "loading"}
            className={cn(primaryActionClassName, compact && "px-3 text-xs")}
            onClick={() => setOffset((prev) => prev + pageSize)}
          />
        </div>
      </div>

      {errorText ? (
        <p className="mb-4 text-sm text-red-400" role="alert">
          {errorText}
        </p>
      ) : null}

      {status === "ready" && items.length === 0 ? (
        <div className="border border-dashed border-cyan-500/30 bg-black/40 px-4 py-8 text-center">
          <p className="font-buahs93 text-lg text-cyan-200/80">NO MATCHES</p>
          <p className="mt-2 text-sm text-white/50">
            Try a shorter name, fewer colors, or clear filters.
          </p>
        </div>
      ) : null}

      <ul
        className={cn(
          "grid gap-2",
          compact
            ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
        )}
      >
        {items.map((card) => {
          const art = cardArtUrl(card.card_art_path, card.card_art_version)
          return (
            <li key={card.id}>
              <button
                type="button"
                aria-label={card.card_name}
                title={
                  onCardActivate
                    ? `${card.card_name} — click to add · middle/right-click details${
                        draggable ? " · drag to a section" : ""
                      }`
                    : `${card.card_name} — click or middle-click for details`
                }
                className={cn(
                  "group w-full overflow-hidden border border-cyan-500/20 bg-black/50 transition-colors hover:border-cyan-400/60",
                  draggable && "cursor-grab active:cursor-grabbing"
                )}
                draggable={draggable}
                onDragStart={(event) => onLibraryDragStart(event, card)}
                onDragEnd={() => {
                  endDeckCardDrag()
                  window.setTimeout(() => {
                    suppressClickRef.current = false
                  }, 0)
                }}
                onClick={() => onCardButtonClick(card)}
                onPointerDown={(event) => {
                  // Middle mouse → zoom/detail (stop scroll pan from stealing it).
                  if (event.button !== 1) return
                  event.preventDefault()
                  event.stopPropagation()
                  setSelected(card)
                }}
                onAuxClick={(event) => {
                  if (event.button === 1) event.preventDefault()
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setSelected(card)
                }}
              >
                {art ? (
                  <img
                    src={art}
                    alt=""
                    draggable={false}
                    className="aspect-[2/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center border border-dashed border-cyan-500/20 font-mono text-[10px] text-cyan-500/40">
                    NO ART
                  </div>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <CardDetailOverlay
        card={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
