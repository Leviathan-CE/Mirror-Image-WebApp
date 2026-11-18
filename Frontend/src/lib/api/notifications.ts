/**
 * Logged-in inbox API (broadcast events + read receipts).
 * Live updates use WebSocket pub/sub — not HTTP polling.
 */

import { apiBaseUrl, authHeaders, readJsonOrThrow } from "@/lib/api/client"

/** Server → client pub/sub topic after a notification_events insert. */
export const INBOX_CHANGED = "inbox.changed"

export function notificationsWsUrl(): string {
  const http = apiBaseUrl()
  const ws = http.replace(/^http/i, "ws")
  return `${ws}/notifications/ws`
}

export type NotificationKind =
  | "announcement.published"
  | "card.created"
  | "card.updated"
  | "card.removed"
  | string

export type NotificationItem = {
  id: number
  kind: NotificationKind
  subject_type: "announcement" | "card" | string
  subject_id: number
  title: string
  summary: string
  payload: Record<string, unknown>
  audience: "all" | "preview" | string
  created_at: string | null
  read: boolean
}

export type NotificationListResponse = {
  items: NotificationItem[]
  total: number
  unread: number
  limit: number
  offset: number
}

export async function fetchNotifications(
  token: string,
  query: { limit?: number; offset?: number } = {}
): Promise<NotificationListResponse> {
  const url = new URL(`${apiBaseUrl()}/notifications`)
  url.searchParams.set("limit", String(query.limit ?? 30))
  url.searchParams.set("offset", String(query.offset ?? 0))
  const response = await fetch(url, { headers: authHeaders(token) })
  return readJsonOrThrow<NotificationListResponse>(
    response,
    "notifications_failed"
  )
}

export async function fetchUnreadCount(
  token: string
): Promise<{ unread: number }> {
  const response = await fetch(
    `${apiBaseUrl()}/notifications/unread-count`,
    { headers: authHeaders(token) }
  )
  return readJsonOrThrow<{ unread: number }>(
    response,
    "notifications_unread_failed"
  )
}

export async function markNotificationRead(
  token: string,
  eventId: number
): Promise<{ read: number }> {
  const response = await fetch(
    `${apiBaseUrl()}/notifications/${eventId}/read`,
    {
      method: "POST",
      headers: authHeaders(token),
    }
  )
  return readJsonOrThrow<{ read: number }>(
    response,
    "notification_read_failed"
  )
}

export async function markAllNotificationsRead(
  token: string
): Promise<{ read: number }> {
  const response = await fetch(
    `${apiBaseUrl()}/notifications/read-all`,
    {
      method: "POST",
      headers: authHeaders(token),
    }
  )
  return readJsonOrThrow<{ read: number }>(
    response,
    "notification_read_all_failed"
  )
}
