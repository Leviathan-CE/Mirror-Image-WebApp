/**
 * Condensed deck-list row: cost, name, TLV, quantity on a colour-tinted bar.
 * Hover reveals the card thumbnail beside the cursor (hidden for classified).
 */

import { useEffect, useState, type MouseEvent } from "react"
import { createPortal } from "react-dom"

import { CardCostIcons } from "@/components/cards/CardCostIcons"
import { GameIcon } from "@/components/common/GameIcon"
import type { CardClassification } from "@/components/decks/ClassifiedCardFace"
import { deckCardRowStyle } from "@/components/decks/deckCardColors"
import { cardFaceUrl, type DeckCardEntry } from "@/lib/api/decks"

type DeckCardListRowProps = {
  card: DeckCardEntry
  classified: CardClassification | null
}

const HOVER_THUMB_WIDTH_PX = 352
const HOVER_THUMB_HEIGHT_PX = Math.round((HOVER_THUMB_WIDTH_PX * 7) / 5)
const HOVER_THUMB_GAP_PX = 18
const HOVER_THUMB_PAD_PX = 8

/** Place the hover card just beside the pointer, flipping at viewport edges. */
export function hoverThumbPoint(clientX: number, clientY: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let x = clientX + HOVER_THUMB_GAP_PX
  let y = clientY + HOVER_THUMB_GAP_PX
  if (x + HOVER_THUMB_WIDTH_PX > vw - HOVER_THUMB_PAD_PX) {
    x = clientX - HOVER_THUMB_GAP_PX - HOVER_THUMB_WIDTH_PX
  }
  if (y + HOVER_THUMB_HEIGHT_PX > vh - HOVER_THUMB_PAD_PX) {
    y = clientY - HOVER_THUMB_GAP_PX - HOVER_THUMB_HEIGHT_PX
  }
  return {
    x: Math.max(
      HOVER_THUMB_PAD_PX,
      Math.min(x, vw - HOVER_THUMB_WIDTH_PX - HOVER_THUMB_PAD_PX)
    ),
    y: Math.max(
      HOVER_THUMB_PAD_PX,
      Math.min(y, vh - HOVER_THUMB_HEIGHT_PX - HOVER_THUMB_PAD_PX)
    ),
  }
}

export function DeckCardListRow({ card, classified }: DeckCardListRowProps) {
  const threat = (card.card.threat_level ?? "0").trim()
  const showThreat =
    classified == null &&
    card.card.is_summon === true &&
    threat !== "" &&
    threat !== "0"
  const style = classified ? undefined : deckCardRowStyle(card.card.cost)
  const art =
    classified == null
      ? cardFaceUrl(card.card)
      : null
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number } | null>(
    null
  )

  useEffect(() => {
    if (!thumbPos) return
    function hideThumb() {
      setThumbPos(null)
    }
    window.addEventListener("dragstart", hideThumb)
    return () => window.removeEventListener("dragstart", hideThumb)
  }, [thumbPos])

  function trackThumb(event: MouseEvent<HTMLDivElement>) {
    if (!art) return
    setThumbPos(hoverThumbPoint(event.clientX, event.clientY))
  }

  return (
    <div
      className="deck-card-list__row"
      style={style}
      onMouseEnter={trackThumb}
      onMouseMove={trackThumb}
      onMouseLeave={() => setThumbPos(null)}
    >
      {classified ? (
        <span className="deck-card-list__tag">
          {classified === "top_secret" ? "TOP SECRET" : "CLASSIFIED"}
        </span>
      ) : (
        <CardCostIcons
          cost={card.card.cost ?? []}
          className="deck-card-list__cost inline-flex shrink-0 items-center gap-0"
          iconClassName="h-6 w-auto"
        />
      )}
      <span className="deck-card-list__name">{card.card.card_name}</span>
      {showThreat ? (
        <span className="deck-card-list__tlv">
          <GameIcon name="threat_lvl" className="h-4 w-auto" />
          {threat}
        </span>
      ) : null}
      {card.quantity > 0 ? (
        <span className="deck-card-list__qty">×{card.quantity}</span>
      ) : null}
      {art && thumbPos
        ? createPortal(
            <img
              src={art}
              alt=""
              className="deck-card-list__hover-art clip-angled"
              draggable={false}
              style={{ left: thumbPos.x, top: thumbPos.y }}
            />,
            document.body
          )
        : null}
    </div>
  )
}
