/**
 * Shared inbox unread count. The bell and /inbox both read this so Mark all
 * read updates the badge without a full page reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import {
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications"

const POLL_MS = 60_000

type InboxContextValue = {
  unread: number
  /** Bumps when reads change so the bell can refetch its preview list. */
  revision: number
  refresh: () => Promise<void>
  markAllRead: () => Promise<void>
  markOneRead: (eventId: number) => Promise<void>
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: PropsWithChildren) {
  const { token, isAuthenticated } = useAuth()
  const [unread, setUnread] = useState(0)
  const [revision, setRevision] = useState(0)

  const bump = useCallback(() => {
    setRevision((n) => n + 1)
  }, [])

  const refresh = useCallback(async () => {
    if (!token) {
      setUnread(0)
      return
    }
    try {
      const result = await fetchUnreadCount(token)
      setUnread(result.unread)
    } catch {
      /* keep last known count */
    }
  }, [token])

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setUnread(0)
      return
    }
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [isAuthenticated, token, refresh])

  const markAllRead = useCallback(async () => {
    if (!token) return
    setUnread(0)
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

  const value = useMemo(
    () => ({
      unread,
      revision,
      refresh,
      markAllRead,
      markOneRead,
    }),
    [unread, revision, refresh, markAllRead, markOneRead]
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
