/**
 * Global overlay for a card inbox event. Lives next to the header so a
 * bell click can open details from any route.
 */

import { useEffect, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { useInbox } from "@/app/providers/InboxProvider"
import { CardDetailOverlay } from "@/components/cards/CardDetailOverlay"
import {
  fetchCardLibrary,
  fetchCatalogueCard,
  type CardLibraryItem,
} from "@/lib/api/cards"
import {
  changeViewFromPayload,
  libraryItemFromNotification,
  type CardDetailChange,
} from "@/lib/cardBanner.logic"

export async function loadLiveCard(
  cardId: number,
  cardName: string,
  token?: string | null
): Promise<CardLibraryItem | null> {
  if (cardName.trim() !== "") {
    try {
      const library = await fetchCardLibrary(
        { q: cardName, limit: 20, offset: 0 },
        token
      )
      const match = library.items.find((item) => item.id === cardId)
      if (match) return match
    } catch {
      /* fall through to by-id */
    }
  }
  try {
    return await fetchCatalogueCard(cardId, token)
  } catch {
    return null
  }
}

export function CardNotificationHost() {
  const { token } = useAuth()
  const { activeCardEvent, closeCardEvent } = useInbox()
  const [card, setCard] = useState<CardLibraryItem | null>(null)
  const [change, setChange] = useState<CardDetailChange | null>(null)

  useEffect(() => {
    if (activeCardEvent == null) {
      setCard(null)
      setChange(null)
      return
    }
    const nextChange = changeViewFromPayload(
      activeCardEvent.kind,
      activeCardEvent.payload
    )
    setChange(nextChange)
    const fallback = libraryItemFromNotification(activeCardEvent)
    setCard(fallback)
    if (activeCardEvent.kind === "card.removed") return
    const cardId = activeCardEvent.subject_id
    if (cardId <= 0) return
    let cancelled = false
    void loadLiveCard(
      cardId,
      fallback?.card_name ?? "",
      token
    ).then((live) => {
      if (cancelled) return
      if (live == null) return
      setCard(live)
    })
    return () => {
      cancelled = true
    }
  }, [activeCardEvent, token])

  if (card == null) return null

  return (
    <CardDetailOverlay
      card={card}
      change={change}
      onClose={closeCardEvent}
    />
  )
}
