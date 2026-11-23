/**
 * One inbox row. Click slides the notice open. Delete hides it.
 */

import {
  useState,
  type MouseEvent,
  type TransitionEvent,
} from "react"

import { InboxCardDetail } from "@/components/inbox/InboxCardDetail"
import { AnnouncementBody } from "@/components/updates/AnnouncementBody"
import { youtubeThumbUrl } from "@/lib/announcement.logic"
import {
  announcementMediaUrl,
  type AnnouncementPost,
} from "@/lib/api/announcements"
import type { NotificationItem } from "@/lib/api/notifications"
import { isCardNotificationKind } from "@/lib/cardBanner.logic"

type InboxNoticeProps = {
  item: NotificationItem
  open: boolean
  selected: boolean
  post: AnnouncementPost | null | undefined
  deleting: boolean
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void
  onDelete: () => void
}

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

function noticeShell(selected: boolean, open: boolean): string {
  if (selected && open) {
    return "border border-cyan-400/50 bg-cyan-500/15 outline-none"
  }
  if (selected) {
    return "border border-cyan-500/40 bg-cyan-500/15 outline-none"
  }
  if (open) {
    return "border border-cyan-400/50 bg-black/55 outline-none"
  }
  return "border border-cyan-500/25 bg-black/55 outline-none"
}

function kindLabel(kind: string): string {
  if (kind === "announcement.published") return "Blog"
  if (kind === "card.created") return "New card"
  if (kind === "card.updated") return "Card updated"
  if (kind === "card.removed") return "Card removed"
  return kind
}

function coverSrc(post: AnnouncementPost): string | null {
  if (post.cover.youtube_id) {
    return youtubeThumbUrl(post.cover.youtube_id)
  }
  return announcementMediaUrl(post.cover.image_url)
}

function NoticeDetails({
  item,
  post,
  onClose,
}: {
  item: NotificationItem
  post: AnnouncementPost | null | undefined
  onClose: () => void
}) {
  if (isCardNotificationKind(item.kind)) {
    return <InboxCardDetail item={item} onClose={onClose} />
  }

  if (post === undefined) {
    return (
      <p
        className={
          "border-t border-cyan-500/20 px-3 py-3 " +
          "font-mono text-xs text-white/45"
        }
      >
        Loading post…
      </p>
    )
  }
  if (post == null) {
    return (
      <p
        className={
          "border-t border-cyan-500/20 px-3 py-3 " +
          "font-mono text-xs text-white/60"
        }
      >
        {item.summary}
      </p>
    )
  }

  const cover = coverSrc(post)
  return (
    <div className="border-t border-cyan-500/20 bg-black/70 p-4 sm:p-5">
      {cover ? (
        <img
          src={cover}
          alt=""
          className="mb-4 max-h-80 w-full object-cover"
        />
      ) : null}
      <AnnouncementBody
        markdown={post.body_markdown}
        images={post.images}
      />
    </div>
  )
}

export function InboxNotice({
  item,
  open,
  selected,
  post,
  deleting,
  onToggle,
  onDelete,
}: InboxNoticeProps) {
  const [shown, setShown] = useState(open)
  const [trackedOpen, setTrackedOpen] = useState(open)
  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (open) setShown(true)
  }

  function finishSlide(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== "grid-template-rows") return
    if (open) return
    setShown(false)
  }

  const shell = noticeShell(selected, open)
  const slide = open
    ? "grid grid-rows-[1fr] overflow-hidden " +
      "transition-[grid-template-rows] duration-300 ease-in-out"
    : "grid grid-rows-[0fr] overflow-hidden " +
      "transition-[grid-template-rows] duration-300 ease-in-out"

  return (
    <li className={shell}>
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left outline-none"
          onMouseDown={(event) => {
            if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
              return
            }
            event.preventDefault()
          }}
          onClick={onToggle}
          aria-expanded={open}
          aria-selected={selected}
        >
          <p
            className={
              "font-buahs93 text-[11px] tracking-wide text-cyan-400/70"
            }
          >
            {kindLabel(item.kind)}
            {item.read ? "" : " · UNREAD"}
          </p>
          <h2 className="mt-1 font-glitch text-lg text-cyan-200">
            {item.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-white/50">
            {item.summary}
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="font-mono text-[10px] text-cyan-100/45">
            {postedLabel(item.created_at)}
          </p>
          <button
            type="button"
            className={
              "font-mono text-[10px] tracking-wide " +
              "text-red-500 hover:text-red-400"
            }
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete ${item.title}`}
          >
            {deleting ? "DELETING…" : "DELETE"}
          </button>
        </div>
      </div>
      <div className={slide} onTransitionEnd={finishSlide}>
        <div className="overflow-hidden">
          {shown ? (
            <NoticeDetails
              item={item}
              post={post}
              onClose={onToggle}
            />
          ) : null}
        </div>
      </div>
    </li>
  )
}
