/**
 * Community deck browse — search + advanced filters (author, tag, card, sort).
 */

import { useEffect, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets/shared"
import { CardSearchBar } from "@/components/cards/CardSearchBar"
import { DeckListCard } from "@/components/decks/DeckListCard"
import { SearchPaginationBar } from "@/components/cards/SearchPaginationBar"
import { EditBox } from "@/components/ui/EditBox"
import { GlitchFx } from "@/components/effects/GlitchFx"
import {
  fetchPublicDecks,
  type DeckSummary,
  type PublicDeckQuery,
} from "@/lib/api/decks"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24

type SortMode = NonNullable<PublicDeckQuery["sort"]>

export function ComunityDecksPage() {
  const { token } = useAuth()
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  const [nameQuery, setNameQuery] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [author, setAuthor] = useState("")
  const [tag, setTag] = useState("")
  const [card, setCard] = useState("")
  const [sort, setSort] = useState<SortMode>("newest")

  // Debounce free-text search like the card library.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQ(nameQuery.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [nameQuery])

  useEffect(() => {
    setOffset(0)
  }, [author, tag, card, sort])

  useEffect(() => {
    let cancelled = false
    setStatus("loading")

    fetchPublicDecks({
      q: debouncedQ || undefined,
      author: author.trim() || undefined,
      tag: tag.trim() || undefined,
      card: card.trim() || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
      token,
    })
      .then((page) => {
        if (cancelled) return
        setDecks(page.items)
        setTotal(page.total)
        setStatus("ready")
      })
      .catch(() => {
        if (cancelled) return
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQ, author, tag, card, sort, offset, token])

  const advancedActive =
    author.trim() !== "" || tag.trim() !== "" || card.trim() !== "" || sort !== "newest"

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + decks.length, total)
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  function clearFilters() {
    setNameQuery("")
    setDebouncedQ("")
    setAuthor("")
    setTag("")
    setCard("")
    setSort("newest")
    setOffset(0)
  }

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-4xl pt-8">
        <h1 className="font-glitch text-3xl text-cyan-300">COMMUNITY DECKS</h1>
        <p className="mt-2 text-sm text-white/50">
          Browse public decks — search by name, author, tags, or cards inside.
        </p>

        <div className="mt-6 space-y-3 border border-cyan-500/20 bg-black/50 p-4">
          <CardSearchBar
            label="SEARCH"
            value={nameQuery}
            onChange={setNameQuery}
            placeholder="Deck name or description…"
          />

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
              FILTERS
              {advancedActive ? (
                <span
                  className="inline-block size-1.5 rounded-full bg-cyan-400"
                  title="Filters active"
                  aria-label="Filters active"
                />
              ) : null}
            </span>
            <span className="font-mono text-[10px] text-cyan-300/70">
              {advancedOpen ? "▲" : "▼"}
            </span>
          </button>

          {advancedOpen ? (
            <div className="grid gap-3 border border-cyan-500/20 border-t-0 bg-black/40 p-3 sm:grid-cols-2">
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

              <label className="block">
                <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                  TAG
                </span>
                <EditBox
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Exact tag…"
                  size="sm"
                  autoComplete="off"
                />
              </label>

              <label className="block sm:col-span-2">
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

              <label className="block sm:col-span-2">
                <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                  SORT
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="w-full border border-white/40 bg-black/80 px-3 py-2 font-mono text-sm text-white outline-none focus-visible:border-white"
                >
                  <option value="newest">Newest</option>
                  <option value="likes">Most likes</option>
                  <option value="views">Most views</option>
                  <option value="name">Name A–Z</option>
                </select>
              </label>

              {advancedActive ? (
                <div className="sm:col-span-2">
                  <GlitchFx
                    type="button"
                    label="CLEAR FILTERS"
                    className="font-buahs93 h-8 w-full rounded-none border border-cyan-500/30 bg-transparent text-xs text-cyan-100 hover:bg-cyan-500/10"
                    onClick={clearFilters}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <SearchPaginationBar
          className="mt-4"
          summary={
            status === "loading"
              ? "Scanning archive…"
              : `${pageStart}–${pageEnd} of ${total}`
          }
          canPrev={canPrev}
          canNext={canNext}
          disabled={status === "loading"}
          onPrev={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
          onNext={() => setOffset((prev) => prev + PAGE_SIZE)}
        />

        {status === "error" && (
          <p className="mt-4" role="alert">
            Could not load community decks.
          </p>
        )}
        {status === "ready" && decks.length === 0 && (
          <p className="mt-6 text-white/50">NO PUBLIC DECKS MATCH</p>
        )}
        {status === "ready" && decks.length > 0 && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {decks.map((deck) => (
              <li key={deck.id}>
                <DeckListCard deck={deck} showAuthor />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
