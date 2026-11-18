/**
 * Logged-in notification inbox.
 */

import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { useInbox } from "@/app/providers/InboxProvider"
import { Button } from "@/components/ui/button"
import { sharedImages } from "@/assets"
import { ApiError } from "@/lib/api/client"
import {
  fetchNotifications,
  type NotificationItem,
} from "@/lib/api/notifications"
import { isCardNotificationKind } from "@/lib/cardBanner.logic"
import { ROUTES } from "@/lib/route"

const PAGE_SIZE = 30

function postedLabel(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function kindLabel(kind: string): string {
  if (kind === "announcement.published") return "Blog"
  if (kind === "card.created") return "New card"
  if (kind === "card.updated") return "Card updated"
  if (kind === "card.removed") return "Card removed"
  return kind
}

export function InboxPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { token } = useAuth()
  const {
    unread,
    markAllRead,
    markOneRead,
    openCardEvent,
    refresh,
  } = useInbox()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [errorText, setErrorText] = useState("")
  const [busy, setBusy] = useState(false)
  const openEventParam = searchParams.get("event")
  const openEventId =
    openEventParam == null ? null : Number.parseInt(openEventParam, 10)
  const openItem =
    openEventId != null && Number.isFinite(openEventId)
      ? items.find((item) => item.id === openEventId) ?? null
      : null

  const loadPage = useCallback(
    async (pageOffset: number) => {
      if (!token) return
      setBusy(true)
      setErrorText("")
      try {
        const result = await fetchNotifications(token, {
          limit: PAGE_SIZE,
          offset: pageOffset,
        })
        setItems(result.items)
        setTotal(result.total)
        setOffset(pageOffset)
        void refresh()
      } catch (error: unknown) {
        setErrorText(
          error instanceof ApiError
            ? "Could not load your inbox."
            : "Could not reach the server."
        )
      } finally {
        setBusy(false)
      }
    },
    [token, refresh]
  )

  useEffect(() => {
    void loadPage(0)
  }, [loadPage])

  useEffect(() => {
    if (openItem == null) return
    if (!isCardNotificationKind(openItem.kind)) return
    void openCardEvent(openItem)
    setSearchParams({})
  }, [openItem, openCardEvent, setSearchParams])

  async function openItemRow(item: NotificationItem) {
    if (!token) return
    if (!item.read) {
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, read: true } : row
        )
      )
      try {
        await markOneRead(item.id)
      } catch {
        /* still open */
      }
    }
    if (item.kind === "announcement.published") {
      const slug = item.payload.slug
      if (typeof slug === "string" && slug.trim() !== "") {
        navigate(`${ROUTES.UPDATES}?slug=${encodeURIComponent(slug)}`)
        return
      }
      navigate(ROUTES.UPDATES)
      return
    }
    if (isCardNotificationKind(item.kind)) {
      await openCardEvent(item)
      return
    }
    setSearchParams({ event: String(item.id) })
    void loadPage(offset)
  }

  async function onMarkAll() {
    if (!token) return
    setBusy(true)
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
    try {
      await markAllRead()
    } catch {
      setErrorText("Could not mark notifications as read.")
      void loadPage(offset)
      setBusy(false)
      return
    }
    setBusy(false)
  }

  const canPrev = offset > 0
  const canNext = offset + items.length < total

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-10 sm:px-6"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-4xl pt-6">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ACCOUNT
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            INBOX
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Blog posts and catalogue changes you have not muted in Settings.
            {unread > 0 ? ` ${unread} unread.` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || unread === 0}
              onClick={() => void onMarkAll()}
            >
              MARK ALL READ
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => navigate(ROUTES.ACCOUNT)}
            >
              NOTIFICATION SETTINGS
            </Button>
          </div>
        </header>

        {errorText ? (
          <p className="font-mono text-sm text-red-400" role="alert">
            {errorText}
          </p>
        ) : null}

        {items.length === 0 && !errorText ? (
          <p className="font-mono text-sm text-white/45">
            {busy ? "Loading inbox…" : "No notifications yet."}
          </p>
        ) : null}

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 border border-cyan-500/25 bg-black/55 p-3 text-left hover:border-cyan-400/50"
                onClick={() => void openItemRow(item)}
                disabled={busy}
              >
                <div className="min-w-0">
                  <p className="font-buahs93 text-[11px] tracking-wide text-cyan-400/70">
                    {kindLabel(item.kind)}
                    {item.read ? "" : " · UNREAD"}
                  </p>
                  <h2 className="mt-1 font-glitch text-lg text-cyan-200">
                    {item.title}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-white/50">
                    {item.summary}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-[10px] text-cyan-100/45">
                  {postedLabel(item.created_at)}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {total > PAGE_SIZE ? (
          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              disabled={busy || !canPrev}
              onClick={() => void loadPage(Math.max(0, offset - PAGE_SIZE))}
            >
              PREVIOUS
            </Button>
            <Button
              type="button"
              disabled={busy || !canNext}
              onClick={() => void loadPage(offset + PAGE_SIZE)}
            >
              NEXT
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
