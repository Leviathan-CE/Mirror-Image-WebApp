/**
 * Staff deck search. Public and private decks, plus print price.
 */

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import { ApiError, sessionGoneText } from "@/lib/api/client"
import {
  fetchAdminDecks,
  patchDeckPrintPrice,
  type AdminDeckItem,
  type DeckVisibility,
} from "@/lib/api/decks_admin"
import { ROUTES } from "@/lib/route"
import { AdminPageShell } from "@/pages/admin/AdminPageShell"

const PAGE_SIZE = 48

const actionClassName =
  "font-buahs93 h-8 rounded-none border border-cyan-500/35 "
  + "bg-black/70 px-2 text-xs text-cyan-100 hover:bg-cyan-500/10 "
  + "disabled:opacity-60"

const selectClassName =
  "h-9 rounded-none border border-cyan-500/35 bg-black/80 "
  + "px-2.5 font-mono text-xs text-cyan-50 outline-none"

function priceLabel(cents: number | null): string {
  if (cents == null) return "Standard"
  if (cents === 0) return "Free"
  const dollars = Math.floor(cents / 100)
  const remainder = String(cents % 100).padStart(2, "0")
  return `$${dollars}.${remainder}`
}

function centsFromDollars(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const parts = trimmed.split(".")
  const dollars = Number(parts[0])
  const fraction = (parts[1] ?? "").padEnd(2, "0")
  const cents = dollars * 100 + Number(fraction)
  if (cents < 50 || cents > 100000) return null
  return cents
}

function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return "Request failed."
  if (error.detail === "deck_print_price_schema_missing") {
    return "Run migration 46_deck_print_price.sql, then try again."
  }
  if (error.status === 403) return "Staff only."
  return sessionGoneText(error.detail, error.detail)
}

export function AdminDecksPage() {
  const { token } = useAuth()
  const [q, setQ] = useState("")
  const [submittedQ, setSubmittedQ] = useState("")
  const [visibility, setVisibility] = useState<DeckVisibility>("all")
  const [items, setItems] = useState<AdminDeckItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    if (!token) return
    try {
      const page = await fetchAdminDecks(token, {
        q: submittedQ,
        visibility,
        limit: PAGE_SIZE,
        offset,
      })
      setItems(page.items)
      setTotal(page.total)
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [token, submittedQ, visibility, offset])

  useEffect(() => {
    void load()
  }, [load])

  async function savePrice(deckId: number, cents: number | null) {
    if (!token || busyId != null) return
    setBusyId(deckId)
    setError(null)
    try {
      const saved = await patchDeckPrintPrice(token, deckId, cents)
      setItems((prev) =>
        prev.map((item) => (item.id === deckId ? saved : item))
      )
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  function onCustomSave(item: AdminDeckItem) {
    const cents = centsFromDollars(drafts[item.id] ?? "")
    if (cents == null) {
      setError("Custom price must be from $0.50 to $1000.00.")
      return
    }
    void savePrice(item.id, cents)
  }

  const pageEnd = Math.min(offset + PAGE_SIZE, total)

  return (
    <AdminPageShell
      title="MANAGE DECKS"
      description={
        "Search public and private decks. Standard uses the card-count "
        + "price. Free turns the print button green and skips payment."
      }
      wide
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setOffset(0)
          setSubmittedQ(q.trim())
        }}
      >
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-white/50">
            Search name, owner, or id
          </span>
          <EditBox
            value={q}
            placeholder="deck name"
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-white/50">
            Visibility
          </span>
          <select
            className={selectClassName}
            value={visibility}
            onChange={(event) => {
              setVisibility(event.target.value as DeckVisibility)
              setOffset(0)
            }}
          >
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
        <Button type="submit" className={actionClassName}>
          SEARCH
        </Button>
      </form>

      {error ? (
        <p className="mt-3 text-sm text-red-300/90">{error}</p>
      ) : null}

      <p className="mt-4 font-mono text-xs text-white/50">
        {total === 0 ? "0 decks" : `${offset + 1}–${pageEnd} of ${total}`}
      </p>

      <div className="mt-3 overflow-x-auto border border-cyan-500/20">
        <table
          className={
            "w-full min-w-[52rem] border-collapse text-left text-sm"
          }
        >
          <thead
            className={
              "bg-black/70 font-mono text-[10px] uppercase text-white/50"
            }
          >
            <tr>
              <th className="px-3 py-2">Deck</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2">Cards</th>
              <th className="px-3 py-2">Print</th>
              <th className="px-3 py-2">Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-cyan-500/15">
                <td className="px-3 py-2">
                  <div className="text-cyan-50">
                    {item.name || "Untitled"}
                  </div>
                  <div className="font-mono text-[10px] text-white/40">
                    #{item.id}
                  </div>
                </td>
                <td className="px-3 py-2 text-cyan-100/80">
                  {item.author_name}
                </td>
                <td className="px-3 py-2">
                  {item.is_public ? "Public" : "Private"}
                </td>
                <td className="px-3 py-2">{item.card_count}</td>
                <td className="px-3 py-2">
                  {priceLabel(item.print_price_cents)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className={actionClassName + " inline-flex items-center"}
                      to={ROUTES.deck(item.id)}
                    >
                      VIEW
                    </Link>
                    <Button
                      type="button"
                      className={actionClassName}
                      disabled={busyId === item.id}
                      onClick={() => void savePrice(item.id, null)}
                    >
                      STANDARD
                    </Button>
                    <Button
                      type="button"
                      className={
                        item.print_price_cents === 0
                          ? actionClassName
                            + " border-emerald-400 text-emerald-200"
                          : actionClassName
                      }
                      disabled={busyId === item.id}
                      onClick={() => void savePrice(item.id, 0)}
                    >
                      FREE
                    </Button>
                    <input
                      className={selectClassName + " w-24"}
                      inputMode="decimal"
                      placeholder="4.99"
                      value={drafts[item.id] ?? ""}
                      onChange={(event) => {
                        const next = event.target.value
                        setDrafts((prev) => ({ ...prev, [item.id]: next }))
                      }}
                    />
                    <Button
                      type="button"
                      className={actionClassName}
                      disabled={busyId === item.id}
                      onClick={() => onCustomSave(item)}
                    >
                      SET
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          className={actionClassName}
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          PREV
        </Button>
        <Button
          type="button"
          className={actionClassName}
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          NEXT
        </Button>
      </div>
    </AdminPageShell>
  )
}
