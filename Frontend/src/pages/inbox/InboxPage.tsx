/**
 * Logged-in notification inbox.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { useInbox } from "@/app/providers/InboxProvider"
import { InboxNotice } from "@/components/inbox/InboxNotice"
import { Button } from "@/components/ui/button"
import { sharedImages } from "@/assets"
import {
  fetchPublishedAnnouncement,
  type AnnouncementPost,
} from "@/lib/api/announcements"
import { ApiError } from "@/lib/api/client"
import {
  dismissAllNotifications,
  dismissNotification,
  dismissNotifications,
  fetchNotifications,
  type NotificationItem,
} from "@/lib/api/notifications"
import { selectionAfterClick } from "@/lib/inboxSelection.logic"
import { ROUTES } from "@/lib/route"

const PAGE_SIZE = 30

function announcementSlug(item: NotificationItem): string {
  const slug = item.payload.slug
  if (typeof slug !== "string") return ""
  return slug.trim()
}

export function InboxPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { token } = useAuth()
  const {
    unread,
    markAllRead,
    markOneRead,
    refresh,
    listEpoch,
  } = useInbox()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [errorText, setErrorText] = useState("")
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [anchorId, setAnchorId] = useState<number | null>(null)
  const [posts, setPosts] = useState<
    Record<number, AnnouncementPost | null>
  >({})
  const openEventParam = searchParams.get("event")
  const openEventId =
    openEventParam == null ? null : Number.parseInt(openEventParam, 10)
  const [trackedEvent, setTrackedEvent] = useState(openEventParam)
  const postsRef = useRef(posts)
  postsRef.current = posts
  const deleteSelectedRef = useRef<() => Promise<void>>(
    async () => {}
  )
  const [trackedEpoch, setTrackedEpoch] = useState(listEpoch)
  if (openEventParam !== trackedEvent) {
    setTrackedEvent(openEventParam)
    if (openEventId != null && Number.isFinite(openEventId)) {
      setExpandedId(openEventId)
    }
  }
  if (listEpoch !== trackedEpoch) {
    setTrackedEpoch(listEpoch)
    setItems([])
    setTotal(0)
    setOffset(0)
    setSelectedIds([])
    setAnchorId(null)
    setExpandedId(null)
  }

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
  }, [loadPage, listEpoch])

  useEffect(() => {
    if (selectedIds.length === 0) return

    function onPointerDown(event: globalThis.MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const kept = target.closest("[data-inbox-selection]")
      if (kept) return
      setSelectedIds([])
      setAnchorId(null)
    }

    document.addEventListener("mousedown", onPointerDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [selectedIds.length])

  useEffect(() => {
    if (selectedIds.length === 0) return

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return
      }
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (target.isContentEditable) return
      event.preventDefault()
      void deleteSelectedRef.current()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [selectedIds.length])

  useEffect(() => {
    if (expandedId == null) return
    const item = items.find((row) => row.id === expandedId)
    if (item == null) return
    if (item.kind !== "announcement.published") return
    if (postsRef.current[item.id] !== undefined) return
    const slug = announcementSlug(item)
    if (slug === "") return
    let cancelled = false
    void fetchPublishedAnnouncement(slug)
      .then((post) => {
        if (cancelled) return
        setPosts((prev) => {
          if (prev[item.id] !== undefined) return prev
          return { ...prev, [item.id]: post }
        })
      })
      .catch(() => {
        if (cancelled) return
        setPosts((prev) => {
          if (prev[item.id] !== undefined) return prev
          return { ...prev, [item.id]: null }
        })
      })
    return () => {
      cancelled = true
    }
  }, [expandedId, items])

  function selectItem(
    item: NotificationItem,
    event: MouseEvent<HTMLButtonElement>
  ) {
    const next = selectionAfterClick({
      orderedIds: items.map((row) => row.id),
      selectedIds,
      anchorId,
      targetId: item.id,
      shift: event.shiftKey,
      ctrl: event.ctrlKey || event.metaKey,
    })
    setSelectedIds(next.selectedIds)
    setAnchorId(next.anchorId)
  }

  async function toggleItem(
    item: NotificationItem,
    event?: MouseEvent<HTMLButtonElement>
  ) {
    if (!token) return
    if (
      event != null &&
      (event.shiftKey || event.ctrlKey || event.metaKey)
    ) {
      selectItem(item, event)
      return
    }
    if (selectedIds.length > 0) {
      setSelectedIds([])
      setAnchorId(null)
    }
    if (expandedId === item.id) {
      setExpandedId(null)
      if (searchParams.get("event") === String(item.id)) {
        setSearchParams({})
      }
      return
    }
    setExpandedId(item.id)
    setAnchorId(item.id)
    if (item.read) return
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, read: true } : row
      )
    )
    try {
      await markOneRead(item.id)
    } catch {
      /* the row stays open */
    }
  }

  async function onDelete(item: NotificationItem) {
    if (!token) return
    if (deletingId != null) return
    setDeletingId(item.id)
    setErrorText("")
    try {
      await dismissNotification(token, item.id)
    } catch {
      setErrorText("Could not delete that notification.")
      setDeletingId(null)
      return
    }
    if (expandedId === item.id) setExpandedId(null)
    setItems((prev) => prev.filter((row) => row.id !== item.id))
    setTotal((count) => (count > 0 ? count - 1 : 0))
    setSelectedIds((prev) => prev.filter((id) => id !== item.id))
    setDeletingId(null)
    void refresh()
  }

  async function onDeleteSelected() {
    if (!token) return
    if (selectedIds.length === 0) return
    if (busy) return
    if (deletingId != null) return
    const ids = selectedIds
    setBusy(true)
    setErrorText("")
    try {
      await dismissNotifications(token, ids)
    } catch {
      setErrorText("Could not delete those notifications.")
      setBusy(false)
      return
    }
    if (expandedId != null && ids.includes(expandedId)) {
      setExpandedId(null)
    }
    setItems((prev) => prev.filter((row) => !ids.includes(row.id)))
    setTotal((count) => Math.max(0, count - ids.length))
    setSelectedIds([])
    setBusy(false)
    void refresh()
  }

  deleteSelectedRef.current = onDeleteSelected

  async function onClearAll() {
    if (!token) return
    if (items.length === 0 && total === 0) return
    setBusy(true)
    setErrorText("")
    try {
      await dismissAllNotifications(token)
    } catch {
      setErrorText("Could not clear notifications.")
      setBusy(false)
      return
    }
    setItems([])
    setTotal(0)
    setOffset(0)
    setExpandedId(null)
    setSelectedIds([])
    setAnchorId(null)
    setBusy(false)
    void refresh()
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
          <p className="mt-2 max-w-2xl text-sm text-white/40">
            Shift-click selects a range. Ctrl-click selects one
            notice. Click elsewhere to clear the selection.
            Backspace or Delete removes the selected notices.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || unread === 0}
              onClick={() => void onMarkAll()}
            >
              MARK ALL AS READ
            </Button>
            <Button
              type="button"
              disabled={busy || (items.length === 0 && total === 0)}
              onClick={() => void onClearAll()}
            >
              CLEAR NOTIFICATIONS
            </Button>
            {selectedIds.length > 0 ? (
              <span data-inbox-selection="">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void onDeleteSelected()}
                >
                  {`DELETE ${selectedIds.length}`}
                </Button>
              </span>
            ) : null}
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

        <ul className="space-y-3" data-inbox-selection="">
          {items.map((item) => (
            <InboxNotice
              key={item.id}
              item={item}
              open={expandedId === item.id}
              selected={selectedIds.includes(item.id)}
              post={posts[item.id]}
              deleting={deletingId === item.id}
              onToggle={(event) => void toggleItem(item, event)}
              onDelete={() => void onDelete(item)}
            />
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
