/**
 * Admin — catalogue cards DB: search, multi-select, bulk publish + lagality.
 */

import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { CardDetailOverlay } from "@/components/cards/CardDetailOverlay"
import { costTokenToIcon } from "@/components/cards/constants"
import { CardSearchBar } from "@/components/cards/CardSearchBar"
import { SearchPaginationBar } from "@/components/cards/SearchPaginationBar"
import { GameIcon } from "@/components/common/GameIcon"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import { ApiError } from "@/lib/api/client"
import {
  fetchCardFacets,
  type CardLibraryFacets,
} from "@/lib/api/cards"
import {
  LAGALITY_OPTIONS,
  PUBLISH_STATUSES,
  bulkUpdateAdminCards,
  fetchAdminCardDetail,
  fetchAdminCardLibrary,
  type AdminCardDetail,
  type AdminCardItem,
  type PublishStatus,
} from "@/lib/api/cards_admin"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"
import { AdminPageShell } from "@/pages/admin/AdminPageShell"

const PAGE_SIZE = 48

const EMPTY_FACETS: CardLibraryFacets = {
  colors: ["LIF", "MET", "POW", "RAM", "TIM", "STL"],
  super_types: [],
  sub_types: [],
  types_lines: [],
  invoke_cost_min: 0,
  invoke_cost_max: 15,
}

const primaryActionClassName =
  "font-buahs93 h-9 rounded-none bg-cyan-700 px-4 text-sm text-white hover:bg-cyan-900 disabled:opacity-60"

const secondaryActionClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

const selectClassName =
  "h-9 rounded-none border border-cyan-500/35 bg-black/80 px-2.5 font-mono text-xs text-cyan-50 outline-none focus-visible:border-cyan-300"

const filterSelectClassName = selectClassName

function publishTone(status: string): string {
  if (status === "published") return "text-emerald-300/90"
  if (status === "preview") return "text-amber-300/90"
  return "text-white/45"
}

export function AdminCardsPage() {
  const { token } = useAuth()

  const [facets, setFacets] = useState<CardLibraryFacets>(EMPTY_FACETS)
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
  const [publishedFilter, setPublishedFilter] = useState<PublishStatus | "">(
    ""
  )
  const [items, setItems] = useState<AdminCardItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorText, setErrorText] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [bulkPublish, setBulkPublish] = useState<PublishStatus | "">("")
  const [bulkLagality, setBulkLagality] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState("")
  const [detail, setDetail] = useState<AdminCardDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
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
    if (!token) return
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
    setSelectedIds(new Set())
  }, [
    debouncedName,
    debouncedDescription,
    colors,
    invokeMin,
    invokeMax,
    typesLine,
    superType,
    subType,
    publishedFilter,
  ])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setStatus("loading")
    setErrorText("")

    const min =
      invokeMin.trim() === "" ? null : Number.parseInt(invokeMin, 10)
    const max =
      invokeMax.trim() === "" ? null : Number.parseInt(invokeMax, 10)

    void fetchAdminCardLibrary(token, {
      q: debouncedName || undefined,
      description: debouncedDescription || undefined,
      colors,
      invokeCostMin: Number.isFinite(min) ? min : null,
      invokeCostMax: Number.isFinite(max) ? max : null,
      typesLine: typesLine || undefined,
      superType: superType || undefined,
      subType: subType || undefined,
      published: publishedFilter || undefined,
      limit: PAGE_SIZE,
      offset,
    })
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
            ? error.status === 403
              ? "Admin access required."
              : "Could not load the cards database."
            : "Could not reach the server."
        )
      })

    return () => {
      cancelled = true
    }
  }, [
    token,
    debouncedName,
    debouncedDescription,
    colors,
    invokeMin,
    invokeMax,
    typesLine,
    superType,
    subType,
    publishedFilter,
    offset,
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
    setPublishedFilter("")
    setOffset(0)
  }

  const pageIds = useMemo(() => items.map((item) => item.id), [items])
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const selectedCount = selectedIds.size

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id)
      } else {
        for (const id of pageIds) next.add(id)
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function openDetail(cardId: number) {
    if (!token || detailLoading) return
    setDetailLoading(true)
    setActionMessage("")
    try {
      const data = await fetchAdminCardDetail(token, cardId)
      setDetail(data)
    } catch (error) {
      setActionMessage(
        error instanceof ApiError
          ? "Could not load card details."
          : "Could not reach the server."
      )
    } finally {
      setDetailLoading(false)
    }
  }

  async function applyBulk() {
    if (!token || selectedCount === 0) return
    if (!bulkPublish && !bulkLagality) {
      setActionMessage("Choose a publish status and/or lagality first.")
      return
    }

    setBusy(true)
    setActionMessage("")
    try {
      const result = await bulkUpdateAdminCards(token, {
        card_ids: [...selectedIds],
        published: bulkPublish || undefined,
        lagality: bulkLagality || undefined,
      })

      setItems((prev) =>
        prev.map((item) => {
          if (!selectedIds.has(item.id)) return item
          return {
            ...item,
            published: bulkPublish || item.published,
            lagality: bulkLagality || item.lagality,
          }
        })
      )
      setActionMessage(`Updated ${result.updated} row(s).`)
      setBulkPublish("")
      setBulkLagality("")
      clearSelection()
    } catch (error: unknown) {
      setActionMessage(
        error instanceof ApiError
          ? "Bulk update failed."
          : "Could not reach the server."
      )
    } finally {
      setBusy(false)
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1
  const pageEnd = Math.min(offset + items.length, total)
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total
  const advancedActive =
    descriptionQuery.trim() !== "" ||
    invokeMin.trim() !== "" ||
    invokeMax.trim() !== "" ||
    typesLine !== "" ||
    superType !== "" ||
    subType !== "" ||
    publishedFilter !== ""

  const colorCostFilters = (
    <div className="grid w-fit grid-cols-6 gap-2">
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
  )

  return (
    <AdminPageShell
      wide
      title="CARDS DB"
      description="Search and filter the catalogue like the public library, multi-select cards, then set publish status or lagality in bulk."
    >
      <div className="mb-4 border border-cyan-500/25 bg-black/55 p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1 basis-48">
              <CardSearchBar
                label=""
                value={nameQuery}
                onChange={setNameQuery}
                placeholder="Closest name match…"
              />
            </div>
            <div className="shrink-0">{colorCostFilters}</div>
            <GlitchFx
              type="button"
              label="CLEAR FILTERS"
              className={cn(secondaryActionClassName, "shrink-0 px-2 text-xs")}
              onClick={clearFilters}
            />
          </div>

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
              <div className="mt-2 grid gap-3 border border-cyan-500/20 border-t-0 bg-black/40 p-3 sm:grid-cols-2">
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

                <label className="block sm:col-span-2">
                  <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
                    PUBLISH STATUS
                  </span>
                  <select
                    value={publishedFilter}
                    onChange={(e) =>
                      setPublishedFilter(e.target.value as PublishStatus | "")
                    }
                    className={filterSelectClassName}
                  >
                    <option value="">Any</option>
                    {PUBLISH_STATUSES.map((value) => (
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
      </div>

      <div className="mb-4 flex flex-col gap-3 border border-cyan-500/25 bg-black/55 p-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="font-mono text-xs text-cyan-300/60 sm:pb-2">
          {status === "loading"
            ? "Loading…"
            : `${pageStart}–${pageEnd} of ${total}`}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 border border-cyan-500/25 bg-black/55 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
              PUBLISH
            </span>
            <select
              className={selectClassName}
              value={bulkPublish}
              onChange={(e) =>
                setBulkPublish(e.target.value as PublishStatus | "")
              }
              disabled={busy || selectedCount === 0}
            >
              <option value="">— leave unchanged —</option>
              {PUBLISH_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block font-buahs93 text-xs text-cyan-200/70">
              LAGALITY
            </span>
            <select
              className={selectClassName}
              value={bulkLagality}
              onChange={(e) => setBulkLagality(e.target.value)}
              disabled={busy || selectedCount === 0}
            >
              <option value="">— leave unchanged —</option>
              {LAGALITY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <Button
            type="button"
            className={primaryActionClassName}
            disabled={busy || selectedCount === 0}
            onClick={() => void applyBulk()}
          >
            APPLY TO {selectedCount || 0}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className={secondaryActionClassName}
            disabled={busy || pageIds.length === 0}
            onClick={togglePage}
          >
            {allPageSelected ? "CLEAR PAGE" : "SELECT PAGE"}
          </Button>
          <Button
            type="button"
            className={secondaryActionClassName}
            disabled={busy || selectedCount === 0}
            onClick={clearSelection}
          >
            CLEAR SELECTION
          </Button>
        </div>
      </div>

      {actionMessage ? (
        <p className="mb-3 font-mono text-xs text-cyan-200/80">{actionMessage}</p>
      ) : null}

      {status === "error" ? (
        <p className="mb-4 border border-red-500/40 bg-red-950/40 px-4 py-3 font-mono text-sm text-red-200">
          {errorText}
        </p>
      ) : null}

      <SearchPaginationBar
        variant="plain"
        className="mb-3"
        canPrev={canPrev}
        canNext={canNext}
        disabled={busy || status === "loading"}
        onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        onNext={() => setOffset((o) => o + PAGE_SIZE)}
      />

      <div className="overflow-x-auto border border-cyan-500/25 bg-black/55">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-cyan-500/25 font-buahs93 text-xs tracking-wide text-cyan-300/80">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePage}
                  disabled={pageIds.length === 0 || busy}
                  aria-label="Select all on page"
                />
              </th>
              <th className="px-2 py-2">CARD</th>
              <th className="px-2 py-2">SET</th>
              <th className="px-2 py-2">PUBLISH</th>
              <th className="px-2 py-2">LAGALITY</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" && items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center font-mono text-xs text-cyan-300/50"
                >
                  Loading catalogue…
                </td>
              </tr>
            ) : null}
            {status === "ready" && items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center font-mono text-xs text-white/40"
                >
                  No cards match this search.
                </td>
              </tr>
            ) : null}
            {items.map((item) => {
              const art = cardArtUrl(item.card_art_path, item.card_art_version)
              const checked = selectedIds.has(item.id)
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-cyan-500/10",
                    checked ? "bg-cyan-500/10" : "hover:bg-cyan-500/5"
                  )}
                >
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(item.id)}
                      disabled={busy}
                      aria-label={`Select ${item.card_name}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left"
                      disabled={busy || detailLoading}
                      title={`View details for ${item.card_name}`}
                      onClick={() => void openDetail(item.id)}
                    >
                      {art ? (
                        <img
                          src={art}
                          alt=""
                          className="h-14 w-10 shrink-0 border border-cyan-500/25 object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-10 shrink-0 items-center justify-center border border-dashed border-cyan-500/20 bg-black/60 font-mono text-[8px] text-cyan-500/40">
                          N/A
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-buahs93 text-sm text-white underline-offset-2 hover:underline">
                          {item.card_name}
                        </p>
                        <p className="truncate font-mono text-[10px] text-cyan-400/55">
                          #{item.id}
                          {item.is_deprecated ? " · deprecated" : ""}
                          {" · "}
                          {item.rarity}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-white/60">
                    {item.card_set_name}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 font-mono text-xs",
                      publishTone(item.published)
                    )}
                  >
                    {item.published}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-cyan-100/80">
                    {item.lagality}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <SearchPaginationBar
        variant="plain"
        className="mt-4"
        canPrev={canPrev}
        canNext={canNext}
        disabled={busy || status === "loading"}
        onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        onNext={() => setOffset((o) => o + PAGE_SIZE)}
      />

      <CardDetailOverlay
        card={
          detail
            ? {
                ...detail,
                cost: detail.cost.map(String),
                keywords: detail.keywords.map(String),
                super_types: detail.super_types.map(String),
                sub_types: detail.sub_types.map(String),
                metaLine: `#${detail.id} · ${detail.published} · ${detail.lagality}${
                  detail.is_deprecated ? " · deprecated" : ""
                }`,
              }
            : null
        }
        onClose={() => setDetail(null)}
      />
    </AdminPageShell>
  )
}
