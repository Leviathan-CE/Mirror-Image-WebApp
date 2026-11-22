/**
 * Shared inbox unread count, card banners, and the active card overlay.
 *
 * Feed updates are pub/sub: the API publishes ``inbox.changed`` after a
 * notification row commits; this provider is a subscriber and refetches once.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import {
  fetchNotifications,
  INBOX_CHANGED,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsWsUrl,
  type NotificationItem,
} from "@/lib/api/notifications"
import {
  bannersFromNotifications,
  eventIdsForCards,
  isCardNotificationKind,
  latestChangeForCard,
  loadSeenEventIds,
  mergeSeenEventIds,
  saveSeenEventIds,
  type CardBannerKind,
  type CardDetailChange,
} from "@/lib/cardBanner.logic"

const CARD_FEED_LIMIT = 100
const WS_RETRY_MS = 2_000
const WS_RETRY_MAX_MS = 30_000

type InboxContextValue = {
  unread: number
  items: NotificationItem[]
  /** Bumps when reads change so lists can refetch. */
  revision: number
  activeCardEvent: NotificationItem | null
  refresh: () => Promise<void>
  markAllRead: () => Promise<void>
  markOneRead: (eventId: number) => Promise<void>
  markCardsSeen: (cardIds: number[]) => void
  bannerForCard: (cardId: number) => CardBannerKind | null
  changeForCard: (cardId: number) => CardDetailChange | null
  openCardEvent: (item: NotificationItem) => Promise<void>
  closeCardEvent: () => void
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: PropsWithChildren) {
  const { token, isAuthenticated, user } = useAuth()
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [revision, setRevision] = useState(0)
  const [seenIds, setSeenIds] = useState<Set<number>>(() => new Set())
  const [activeCardEvent, setActiveCardEvent] =
    useState<NotificationItem | null>(null)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  const bump = useCallback(() => {
    setRevision((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!user) {
      setSeenIds(new Set())
      setItems([])
      setActiveCardEvent(null)
      return
    }
    setSeenIds(new Set(loadSeenEventIds(user.id)))
  }, [user])

  const refresh = useCallback(async () => {
    if (!token) {
      setUnread(0)
      setItems([])
      return
    }
    try {
      const result = await fetchNotifications(token, {
        limit: CARD_FEED_LIMIT,
        offset: 0,
      })
      setUnread(result.unread)
      setItems(result.items)
    } catch {
      /* keep last known count */
    }
  }, [token])

  refreshRef.current = refresh

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setUnread(0)
      setItems([])
      return
    }
    void refresh()
  }, [isAuthenticated, token, refresh])

  useEffect(() => {
    if (!isAuthenticated || !token) return

    let cancelled = false
    let socket: WebSocket | null = null
    let retryTimer: number | null = null
    let retryMs = WS_RETRY_MS

    function clearRetry() {
      if (retryTimer == null) return
      window.clearTimeout(retryTimer)
      retryTimer = null
    }

    function scheduleReconnect() {
      if (cancelled) return
      clearRetry()
      retryTimer = window.setTimeout(() => {
        openSocket()
      }, retryMs)
      retryMs = Math.min(retryMs * 2, WS_RETRY_MAX_MS)
    }

    function openSocket() {
      if (cancelled) return
      clearRetry()
      const ws = new WebSocket(notificationsWsUrl())
      socket = ws

      ws.onopen = () => {
        if (cancelled) {
          ws.close()
          return
        }
        retryMs = WS_RETRY_MS
        ws.send(JSON.stringify({ type: "auth" }))
      }

      ws.onmessage = (event) => {
        if (cancelled) return
        let payload: unknown
        try {
          payload = JSON.parse(String(event.data))
        } catch {
          return
        }
        if (payload == null) return
        if (typeof payload !== "object") return
        const message = payload as { type?: string }
        if (message.type !== INBOX_CHANGED) return
        void refreshRef.current()
      }

      ws.onclose = () => {
        if (socket === ws) socket = null
        scheduleReconnect()
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    openSocket()

    return () => {
      cancelled = true
      clearRetry()
      if (socket) {
        socket.onclose = null
        socket.close()
        socket = null
      }
    }
  }, [isAuthenticated, token])

  const markAllRead = useCallback(async () => {
    if (!token) return
    setUnread(0)
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
    bump()
    try {
      await markAllNotificationsRead(token)
    } catch (error: unknown) {
      await refresh()
      bump()
      throw error
    }
    await refresh()
    bump()
  }, [token, refresh, bump])

  const markOneRead = useCallback(
    async (eventId: number) => {
      if (!token) return
      if (eventId <= 0) return
      setUnread((n) => (n > 0 ? n - 1 : 0))
      setItems((prev) =>
        prev.map((item) =>
          item.id === eventId ? { ...item, read: true } : item
        )
      )
      bump()
      try {
        await markNotificationRead(token, eventId)
      } catch {
        await refresh()
        bump()
        return
      }
      await refresh()
      bump()
    },
    [token, refresh, bump]
  )

  const markCardsSeen = useCallback(
    (cardIds: number[]) => {
      if (!user) return
      if (cardIds.length === 0) return
      const adding = eventIdsForCards(items, cardIds)
      if (adding.length === 0) return
      setSeenIds((prev) => {
        const nextIds = mergeSeenEventIds([...prev], adding)
        const unchanged =
          nextIds.length === prev.size &&
          nextIds.every((id) => prev.has(id))
        if (unchanged) return prev
        saveSeenEventIds(user.id, nextIds)
        return new Set(nextIds)
      })
    },
    [user, items]
  )

  const bannersByCardId = useMemo(
    () => bannersFromNotifications(items, seenIds),
    [items, seenIds]
  )

  const bannerForCard = useCallback(
    (cardId: number): CardBannerKind | null => {
      const banner = bannersByCardId.get(cardId)
      if (!banner) return null
      return banner.kind
    },
    [bannersByCardId]
  )

  const changeForCard = useCallback(
    (cardId: number): CardDetailChange | null => {
      return latestChangeForCard(items, cardId)
    },
    [items]
  )

  const openCardEvent = useCallback(
    async (item: NotificationItem) => {
      if (!isCardNotificationKind(item.kind)) return
      setActiveCardEvent(item)
      markCardsSeen([item.subject_id])
      if (item.read) return
      try {
        await markOneRead(item.id)
      } catch {
        /* overlay still opens */
      }
    },
    [markCardsSeen, markOneRead]
  )

  const closeCardEvent = useCallback(() => {
    setActiveCardEvent(null)
  }, [])

  const value = useMemo(
    () => ({
      unread,
      items,
      revision,
      activeCardEvent,
      refresh,
      markAllRead,
      markOneRead,
      markCardsSeen,
      bannerForCard,
      changeForCard,
      openCardEvent,
      closeCardEvent,
    }),
    [
      unread,
      items,
      revision,
      activeCardEvent,
      refresh,
      markAllRead,
      markOneRead,
      markCardsSeen,
      bannerForCard,
      changeForCard,
      openCardEvent,
      closeCardEvent,
    ]
  )

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  )
}

export function useInbox(): InboxContextValue {
  const value = useContext(InboxContext)
  if (!value) {
    throw new Error("useInbox must be used within InboxProvider")
  }
  return value
}
