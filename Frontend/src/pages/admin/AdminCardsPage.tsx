/**
 * Admin — catalogue cards DB: search, multi-select, bulk publish + lagality.
 */

import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { CardSearchBar } from "@/components/cards/CardSearchBar"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import {
  LAGALITY_OPTIONS,
  PUBLISH_STATUSES,
  bulkUpdateAdminCards,
  fetchAdminCardLibrary,
  type AdminCardItem,
  type PublishStatus,
} from "@/lib/api/cards_admin"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"
import { AdminPageShell } from "@/pages/admin/AdminPageShell"

const PAGE_SIZE = 48

const primaryActionClassName =
  "font-buahs93 h-9 rounded-none bg-cyan-700 px-4 text-sm text-white hover:bg-cyan-900 disabled:opacity-60"

const secondaryActionClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

const selectClassName =
  "h-9 rounded-none border border-cyan-500/35 bg-black/80 px-2.5 font-mono text-xs text-cyan-50 outline-none focus-visible:border-cyan-300"

function publishTone(status: string): string {
  if (status === "published") return "text-emerald-300/90"
  if (status === "preview") return "text-amber-300/90"
  return "text-white/45"
}

type PaginationBarProps = {
  canPrev: boolean
  canNext: boolean
  disabled: boolean
  onPrev: () => void
  onNext: () => void
  className?: string
}

function PaginationBar({
  canPrev,
  canNext,
  disabled,
  onPrev,
  onNext,
  className,
}: PaginationBarProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Button
        type="button"
        className={secondaryActionClassName}
        disabled={!canPrev || disabled}
        onClick={onPrev}
      >
        PREV
      </Button>
      <Button
        type="button"
        className={secondaryActionClassName}
        disabled={!canNext || disabled}
        onClick={onNext}
      >
        NEXT
      </Button>
    </div>
  )
}

export function AdminCardsPage() {
  const { token } = useAuth()

  const [nameQuery, setNameQuery] = useState("")
  const [debouncedName, setDebouncedName] = useState("")
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedName(nameQuery.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [nameQuery])

  useEffect(() => {
    setOffset(0)
    setSelectedIds(new Set())
  }, [debouncedName])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setStatus("loading")
    setErrorText("")

    void fetchAdminCardLibrary(token, {
      q: debouncedName || undefined,
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
  }, [token, debouncedName, offset])

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

  return (
    <AdminPageShell
      wide
      title="CARDS DB"
      description="Search the catalogue, multi-select cards, then set publish status or lagality in bulk."
    >
      <div className="mb-4 flex flex-col gap-3 border border-cyan-500/25 bg-black/55 p-4 sm:flex-row sm:items-end">
        <CardSearchBar
          className="max-w-xl flex-1"
          label="NAME"
          value={nameQuery}
          onChange={setNameQuery}
          placeholder="Closest name match…"
        />
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

      <PaginationBar
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
                    <div className="flex items-center gap-3">
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
                        <p className="truncate font-buahs93 text-sm text-white">
                          {item.card_name}
                        </p>
                        <p className="truncate font-mono text-[10px] text-cyan-400/55">
                          #{item.id}
                          {item.is_deprecated ? " · deprecated" : ""}
                          {" · "}
                          {item.rarity}
                        </p>
                      </div>
                    </div>
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

      <PaginationBar
        className="mt-4"
        canPrev={canPrev}
        canNext={canNext}
        disabled={busy || status === "loading"}
        onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        onNext={() => setOffset((o) => o + PAGE_SIZE)}
      />
    </AdminPageShell>
  )
}
