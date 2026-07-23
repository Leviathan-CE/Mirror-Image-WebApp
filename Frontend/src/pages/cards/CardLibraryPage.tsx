/**
 * Card library browser — search + filters over the full card DB.
 */

import { useEffect, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets"
import { CardCostIcons, costTokenToIcon } from "@/components/cards/CardCostIcons"
import { CardRulesText } from "@/components/cards/CardRulesText"
import { CardSearchBar } from "@/components/cards/CardSearchBar"
import { parseKeyword } from "@/components/cards/keywordHelp"
import { GameIcon } from "@/components/common/GameIcon"
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

const PAGE_SIZE = 48

/** Match MainPage / deck builder action chrome. */
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

export function CardLibraryPage() {
  const { token } = useAuth()
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
        limit: PAGE_SIZE,
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

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + items.length, total)
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-10 sm:px-6"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-6xl pt-6">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ARCHIVE
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            CARD LIBRARY
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Search by name (closest match), filter by cost colors, invoke cost,
            type line, super/sub types, and rules text.
          </p>
        </header>

        <div className="mb-6 grid gap-4 border border-cyan-500/25 bg-black/55 p-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <CardSearchBar
                label="NAME"
                value={nameQuery}
                onChange={setNameQuery}
                placeholder="Closest name match…"
              />
            </div>

            <label className="block sm:col-span-2">
              <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                DESCRIPTION
              </span>
              <EditBox
                value={descriptionQuery}
                onChange={(e) => setDescriptionQuery(e.target.value)}
                placeholder="Rules text contains…"
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
                onChange={(e) => setInvokeMin(e.target.value.replace(/\D/g, ""))}
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
                onChange={(e) => setInvokeMax(e.target.value.replace(/\D/g, ""))}
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

            <label className="block sm:col-span-2">
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

          <div>
            <p className="mb-2 font-buahs93 text-xs text-cyan-200/70">
              COLOR COST
            </p>
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
              className={cn(secondaryActionClassName, "mt-4")}
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
              className={secondaryActionClassName}
              onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
            />
            <GlitchFx
              type="button"
              label="NEXT"
              disabled={!canNext || status === "loading"}
              className={primaryActionClassName}
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            />
          </div>
        </div>

        {errorText ? (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {errorText}
          </p>
        ) : null}

        {status === "ready" && items.length === 0 ? (
          <div className="border border-dashed border-cyan-500/30 bg-black/40 px-6 py-12 text-center">
            <p className="font-buahs93 text-lg text-cyan-200/80">NO MATCHES</p>
            <p className="mt-2 text-sm text-white/50">
              Try a shorter name, fewer colors, or clear filters.
            </p>
          </div>
        ) : null}

        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {items.map((card) => {
            const art = cardArtUrl(card.card_art_path, card.card_art_version)
            return (
              <li key={card.id}>
                <button
                  type="button"
                  aria-label={card.card_name}
                  className="group w-full overflow-hidden border border-cyan-500/20 bg-black/50 transition-colors hover:border-cyan-400/60"
                  onClick={() => setSelected(card)}
                >
                  {art ? (
                    <img
                      src={art}
                      alt=""
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
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={selected.card_name}
          onClick={() => setSelected(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSelected(null)
          }}
        >
          <div
            className="grid max-h-[min(96vh,100%)] w-full max-w-[min(96vw,90rem)] gap-4 overflow-y-auto border border-cyan-500/30 bg-black/95 p-3 sm:gap-6 sm:p-5 md:grid-cols-[minmax(14rem,42%)_minmax(0,1fr)] md:gap-8 md:p-6 lg:grid-cols-[minmax(18rem,46%)_minmax(0,1fr)]"
            onClick={(e) => e.stopPropagation()}
          >
            {cardArtUrl(selected.card_art_path, selected.card_art_version) ? (
              <img
                src={
                  cardArtUrl(selected.card_art_path, selected.card_art_version) ??
                  undefined
                }
                alt=""
                className="mx-auto h-auto max-h-[min(70vh,52rem)] w-full max-w-md object-contain md:max-h-[min(88vh,64rem)] md:max-w-none"
              />
            ) : (
              <div className="flex aspect-[2/3] max-h-[70vh] items-center justify-center border border-dashed border-cyan-500/25 font-mono text-xs text-cyan-500/40 md:max-h-[88vh]">
                NO ART
              </div>
            )}
            <div className="flex min-h-0 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-glitch text-3xl text-cyan-300 sm:text-4xl lg:text-5xl">
                  {selected.card_name}
                </h2>
                <GlitchFx
                  type="button"
                  label="CLOSE"
                  className={secondaryActionClassName}
                  onClick={() => setSelected(null)}
                />
              </div>
              <p className="mt-2 font-mono text-sm text-cyan-400/70 sm:text-base">
                {selected.card_set_name} · {selected.rarity}
              </p>
              <div className="mt-4 flex flex-wrap items-start gap-8 sm:mt-5">
                <div className="space-y-2">
                  <p className="font-buahs93 text-sm text-cyan-200/80 sm:text-base">
                    INVOKE COST
                  </p>
                  <CardCostIcons
                    cost={selected.cost}
                    iconClassName="h-6 w-auto lg:h-7 2xl:h-7"
                  />
                </div>
                {selected.threat_level &&
                selected.threat_level !== "0" &&
                selected.threat_level.trim() !== "" ? (
                  <div className="space-y-2">
                    <p className="font-buahs93 text-sm text-cyan-200/80 sm:text-base">
                      THREAT LEVEL
                    </p>
                    <div className="flex items-center gap-1.5">
                      <GameIcon
                        name="threat_lvl"
                        className="h-7 w-auto lg:h-8 2xl:h-8"
                      />
                      <span className="font-buahs93 text-base text-cyan-100 sm:text-lg">
                        {selected.threat_level}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <p className="mt-4 font-mono text-sm text-white/55 sm:text-base">
                {[...selected.super_types, ...selected.sub_types]
                  .filter(Boolean)
                  .join(" · ") || "—"}
                {selected.types_line ? ` · ${selected.types_line}` : ""}
              </p>

              {(selected.keywords?.length ?? 0) > 0 ? (
                <div className="mt-5 border border-cyan-500/20 bg-black/40 p-3 sm:p-4">
                  <p className="font-buahs93 text-xs tracking-wide text-cyan-300/80">
                    KEYWORDS
                  </p>
                  <ul className="mt-2 space-y-2">
                    {selected.keywords.map((raw) => {
                      const kw = parseKeyword(raw)
                      return (
                        <li key={raw} className="text-sm sm:text-base">
                          <span className="font-buahs93 text-cyan-100">
                            {kw.label}
                          </span>
                          {kw.help ? (
                            <span className="mt-0.5 block italic text-white/60">
                              {kw.help}
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 sm:mt-6">
                <p className="mb-2 font-buahs93 text-xs tracking-wide text-cyan-300/80">
                  RULES TEXT
                </p>
                <CardRulesText text={selected.description} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
