/**
 * Shared public-deck browse: closest-name search + advanced filters.
 * Used on /comunity_decks and the home COMMUNITY tab.
 */

import { useEffect, useState } from "react"

import { costTokenToIcon } from "@/components/cards/constants"
import { CardSearchBar } from "@/components/cards/CardSearchBar"
import { SearchPaginationBar } from "@/components/cards/SearchPaginationBar"
import { GameIcon } from "@/components/common/GameIcon"
import { DeckListCard } from "@/components/decks/DeckListCard"
import { DeckTagSuggestInput } from "@/components/decks/DeckTagSuggestInput"
import { DECK_RESOURCE_COLORS } from "@/components/decks/deckCardColors"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import {
  fetchPublicDecks,
  type DeckSummary,
  type PublicDeckColorMode,
  type PublicDeckSort,
} from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24

const SORT_OPTIONS: { id: PublicDeckSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "likes", label: "Likes · highest" },
  { id: "likes_asc", label: "Likes · lowest" },
  { id: "views", label: "Views · highest" },
  { id: "views_asc", label: "Views · lowest" },
]

const COLOR_MODE_OPTIONS: { id: PublicDeckColorMode; label: string }[] = [
  { id: "or", label: "OR" },
  { id: "and", label: "AND" },
  { id: "not", label: "NOT" },
]

const filterSelectClassName =
  "h-9 w-full rounded-none border border-cyan-500/35 bg-black/80 px-2.5 font-mono text-xs text-cyan-50 outline-none focus-visible:border-cyan-300"

export type CommunityDeckBrowserProps = {
  token?: string | null
  className?: string
  /** Optional heading block above the filters. */
  title?: string
  description?: string
}

export function CommunityDeckBrowser({
  token,
  className,
  title,
  description,
}: CommunityDeckBrowserProps) {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [nameQuery, setNameQuery] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [author, setAuthor] = useState("")
  const [debouncedAuthor, setDebouncedAuthor] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [card, setCard] = useState("")
  const [debouncedCard, setDebouncedCard] = useState("")
  const [colors, setColors] = useState<string[]>([])
  const [colorMode, setColorMode] = useState<PublicDeckColorMode>("or")
  const [sort, setSort] = useState<PublicDeckSort>("newest")

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQ(nameQuery.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [nameQuery])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedAuthor(author.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [author])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedCard(card.trim())
    }, 300)
    return () => window.clearTimeout(handle)
  }, [card])

  useEffect(() => {
    setOffset(0)
  }, [debouncedQ, debouncedAuthor, debouncedCard, tags, colors, colorMode, sort])

  useEffect(() => {
    let cancelled = false
    const hasExistingResults = decks.length > 0
    if (hasExistingResults) setIsRefreshing(true)
    else setStatus("loading")

    void fetchPublicDecks({
      q: debouncedQ || undefined,
      author: debouncedAuthor || undefined,
      tags: tags.length > 0 ? tags : undefined,
      card: debouncedCard || undefined,
      colors: colors.length > 0 ? colors : undefined,
      colorMode: colors.length > 0 ? colorMode : undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
      token,
    })
      .then((page) => {
        if (cancelled) return
        setDecks(page.items)
        setTotal(page.total)
        setIsRefreshing(false)
        setStatus("ready")
      })
      .catch(() => {
        if (cancelled) return
        setIsRefreshing(false)
        setStatus("error")
        if (!hasExistingResults) {
          setDecks([])
          setTotal(0)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    debouncedQ,
    debouncedAuthor,
    debouncedCard,
    tags,
    colors,
    colorMode,
    sort,
    offset,
    token,
  ])

  const advancedActive =
    author.trim() !== "" ||
    tags.length > 0 ||
    card.trim() !== "" ||
    colors.length > 0 ||
    colorMode !== "or" ||
    sort !== "newest"

  const filtersActive = nameQuery.trim() !== "" || advancedActive

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + decks.length, total)
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  function addFilterTag(raw: string) {
    const next = raw.trim()
    if (!next) return
    setTags((prev) => (prev.includes(next) ? prev : [...prev, next]))
    setTagDraft("")
  }

  function removeFilterTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function toggleColor(color: string) {
    setColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    )
  }

  function clearFilters() {
    setNameQuery("")
    setDebouncedQ("")
    setAuthor("")
    setDebouncedAuthor("")
    setTags([])
    setTagDraft("")
    setCard("")
    setDebouncedCard("")
    setColors([])
    setColorMode("or")
    setSort("newest")
    setOffset(0)
  }

  return (
    <div className={cn("w-full", className)}>
      {title ? (
        <div className="mb-4">
          <h2 className="font-buahs93 text-xl text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-white/50">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 border border-cyan-500/20 bg-black/50 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-48">
            <CardSearchBar
              label=""
              value={nameQuery}
              onChange={setNameQuery}
              placeholder="Closest deck name match…"
            />
          </div>
          <GlitchFx
            type="button"
            label="CLEAR FILTERS"
            disabled={!filtersActive}
            className={cn(
              "font-buahs93 h-9 shrink-0 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-xs text-cyan-100",
              "hover:border-cyan-400/60 hover:bg-cyan-500/10 disabled:opacity-40"
            )}
            onClick={clearFilters}
          />
        </div>

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
          <div className="space-y-3 border border-cyan-500/20 border-t-0 bg-black/40 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid w-fit grid-cols-6 gap-2">
                {DECK_RESOURCE_COLORS.map((color) => {
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
                        "size-9 overflow-visible rounded-none border",
                        on
                          ? "border-cyan-400 bg-cyan-700 hover:bg-cyan-800"
                          : "border-cyan-500/40 bg-black/70 hover:border-cyan-400/70 hover:bg-cyan-500/10"
                      )}
                      onClick={() => toggleColor(color)}
                    >
                      {icon ? (
                        <GameIcon
                          name={icon}
                          className="!h-5 !w-5 shrink-0 object-contain"
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
              <div
                className="inline-flex border border-cyan-500/35"
                role="group"
                aria-label="Colour match mode"
              >
                {COLOR_MODE_OPTIONS.map((opt) => {
                  const on = colorMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={on}
                      className={cn(
                        "font-buahs93 h-9 min-w-12 px-3 text-xs tracking-wide",
                        on
                          ? "bg-cyan-700 text-white"
                          : "bg-black/70 text-cyan-100 hover:bg-cyan-500/10"
                      )}
                      onClick={() => setColorMode(opt.id)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                  AUTHOR
                </span>
                <EditBox
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Username contains…"
                  size="sm"
                  autoComplete="off"
                />
              </label>

              <div className="block">
                <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                  TAGS
                </span>
                {tags.length > 0 ? (
                  <p className="mb-2 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100"
                      >
                        {t}
                        <button
                          type="button"
                          className="text-cyan-300/70 hover:text-red-300"
                          aria-label={`Remove tag filter ${t}`}
                          onClick={() => removeFilterTag(t)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </p>
                ) : null}
                <DeckTagSuggestInput
                  value={tagDraft}
                  onChange={setTagDraft}
                  exclude={tags}
                  placeholder="Add tag filter…"
                  className="w-full"
                  onPick={addFilterTag}
                />
              </div>

              <label className="block">
                <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                  CONTAINS CARD
                </span>
                <EditBox
                  value={card}
                  onChange={(e) => setCard(e.target.value)}
                  placeholder="Card name contains…"
                  size="sm"
                  autoComplete="off"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                  SORT
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as PublicDeckSort)}
                  className={filterSelectClassName}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </div>

      <SearchPaginationBar
        className="mt-4"
        summary={
          status === "loading" && decks.length === 0
            ? "Scanning archive…"
            : isRefreshing
              ? "Updating results…"
              : `${pageStart}–${pageEnd} of ${total}`
        }
        canPrev={canPrev}
        canNext={canNext}
        disabled={status === "loading" && decks.length === 0}
        onPrev={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
        onNext={() => setOffset((prev) => prev + PAGE_SIZE)}
      />

      {status === "error" ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          Could not load community decks.
        </p>
      ) : null}
      {status === "loading" && decks.length === 0 ? (
        <p className="mt-6 text-white/50">Scanning archive…</p>
      ) : null}
      {status === "ready" && decks.length === 0 ? (
        <p className="mt-6 text-white/50">NO PUBLIC DECKS MATCH</p>
      ) : null}
      {decks.length > 0 ? (
        <ul
          className={cn(
            "mt-6 grid auto-rows-fr gap-4 transition-opacity duration-200 sm:grid-cols-2",
            isRefreshing && "pointer-events-none opacity-50"
          )}
          aria-busy={isRefreshing}
        >
          {decks.map((deck) => (
            <li key={deck.id} className="h-full">
              <DeckListCard deck={deck} showAuthor />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
