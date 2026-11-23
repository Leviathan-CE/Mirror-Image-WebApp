/**
 * Catalogue card window, shown inside an inbox slide.
 */

import { useEffect, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { CardDetailOverlay } from "@/components/cards/CardDetailOverlay"
import { loadLiveCard } from "@/components/inbox/CardNotificationHost"
import type { CardLibraryItem } from "@/lib/api/cards"
import type { NotificationItem } from "@/lib/api/notifications"
import {
  changeViewFromPayload,
  libraryItemFromNotification,
} from "@/lib/cardBanner.logic"

type InboxCardDetailProps = {
  item: NotificationItem
  onClose: () => void
}

export function InboxCardDetail({
  item,
  onClose,
}: InboxCardDetailProps) {
  const { token } = useAuth()
  const [card, setCard] = useState<CardLibraryItem | null>(
    () => libraryItemFromNotification(item)
  )
  const [trackedId, setTrackedId] = useState(item.id)
  if (item.id !== trackedId) {
    setTrackedId(item.id)
    setCard(libraryItemFromNotification(item))
  }

  useEffect(() => {
    if (item.kind === "card.removed") return
    if (item.subject_id <= 0) return
    const fallback = libraryItemFromNotification(item)
    const name = fallback?.card_name ?? ""
    let cancelled = false
    void loadLiveCard(item.subject_id, name, token).then((live) => {
      if (cancelled) return
      if (live == null) return
      setCard(live)
    })
    return () => {
      cancelled = true
    }
  }, [item, token])

  if (card == null) {
    return (
      <p
        className={
          "border-t border-cyan-500/20 px-3 py-3 " +
          "font-mono text-xs text-white/55"
        }
      >
        This card is no longer in the catalogue.
      </p>
    )
  }

  const change = changeViewFromPayload(item.kind, item.payload)

  return (
    <div className="border-t border-cyan-500/20">
      <CardDetailOverlay
        card={card}
        change={change}
        embedded
        onClose={onClose}
      />
    </div>
  )
}
