/**
 * Header inbox trigger: unread badge, recent items, link to /inbox.
 * Card rows open the catalogue overlay instead of jumping to /inbox.
 */

import { Bell } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useInbox } from "@/app/providers/InboxProvider"
import { navButtonClassName } from "@/components/common/headerStyles"
import { DropdownMenu } from "@/components/ui/DropdownMenu"
import type { NotificationItem } from "@/lib/api/notifications"
import { isCardNotificationKind } from "@/lib/cardBanner.logic"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

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
  const {
    unread,
    items,
    markOneRead,
    markCardsSeen,
    openCardEvent,
  } = useInbox()
  const preview = items.slice(0, PREVIEW_LIMIT)

  async function openItem(item: NotificationItem) {
    if (isCardNotificationKind(item.kind)) {
      await openCardEvent(item)
      return
    }
    if (!item.read) {
      try {
        await markOneRead(item.id)
      } catch {
        /* still navigate */
      }
    }
    navigate(destinationFor(item))
  }

  function onMenuOpenChange(open: boolean) {
    if (!open) return
    const cardIds: number[] = []
    for (const item of preview) {
      if (!isCardNotificationKind(item.kind)) continue
      cardIds.push(item.subject_id)
    }
    markCardsSeen(cardIds)
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

  const menuItems = [
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
      onOpenChange={onMenuOpenChange}
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
      items={menuItems}
    />
  )
}
