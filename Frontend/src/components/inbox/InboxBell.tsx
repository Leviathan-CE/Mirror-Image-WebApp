/**
 * Header inbox trigger: unread badge, recent items, link to /inbox.
 */

import { useCallback, useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { useInbox } from "@/app/providers/InboxProvider"
import { navButtonClassName } from "@/components/common/headerStyles"
import { DropdownMenu } from "@/components/ui/DropdownMenu"
import { ApiError } from "@/lib/api/client"
import {
  fetchNotifications,
  type NotificationItem,
} from "@/lib/api/notifications"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

const POLL_MS = 60_000
const PREVIEW_LIMIT = 8

function destinationFor(item: NotificationItem): string {
  if (item.kind === "announcement.published") {
    const slug = item.payload.slug
    if (typeof slug === "string" && slug.trim() !== "") {
      return `${ROUTES.UPDATES}?slug=${encodeURIComponent(slug)}`
    }
    return ROUTES.UPDATES
  }
  return `${ROUTES.INBOX}?event=${item.id}`
}

export function InboxBell() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { unread, revision, markOneRead } = useInbox()
  const [preview, setPreview] = useState<NotificationItem[]>([])

  const refreshPreview = useCallback(async () => {
    if (!token) return
    try {
      const result = await fetchNotifications(token, {
        limit: PREVIEW_LIMIT,
        offset: 0,
      })
      setPreview(result.items)
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) return
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    void refreshPreview()
    const timer = window.setInterval(() => {
      void refreshPreview()
    }, POLL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [token, revision, refreshPreview])

  async function openItem(item: NotificationItem) {
    if (!item.read) {
      try {
        await markOneRead(item.id)
      } catch {
        /* still navigate */
      }
    }
    void refreshPreview()
    navigate(destinationFor(item))
  }

  const previewItems =
    preview.length === 0
      ? [{ id: "empty", label: "No notifications", disabled: true }]
      : preview.map((item) => ({
          id: `n-${item.id}`,
          label: item.read ? item.title : `● ${item.title}`,
          onSelect: () => {
            void openItem(item)
          },
        }))

  const items = [
    ...previewItems,
    { id: "sep-inbox", separator: true as const },
    {
      id: "open-inbox",
      label: "Open inbox",
      onSelect: () => navigate(ROUTES.INBOX),
    },
  ]

  const badge = unread > 99 ? "99+" : String(unread)

  return (
    <DropdownMenu
      label="Inbox"
      align="right"
      trigger={
        <span className="relative inline-flex h-5 w-5 items-center justify-center">
          <Bell
            aria-hidden="true"
            className="h-4 w-4 text-cyan-200"
            strokeWidth={1.75}
          />
          {unread > 0 ? (
            <span
              className={
                "absolute -right-1.5 -top-1.5 min-w-4 " +
                "px-0.5 text-center font-mono text-[9px] " +
                "leading-4 text-cyan-300"
              }
            >
              {badge}
            </span>
          ) : null}
        </span>
      }
      triggerClassName={cn(navButtonClassName, "h-8 w-8 px-0")}
      menuClassName="min-w-[14rem] max-w-[18rem]"
      items={items}
    />
  )
}
