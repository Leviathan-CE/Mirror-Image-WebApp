/**
 * Large card face shown beside the hovered card (MTG Arena style).
 * It does not take clicks, so the pointer stays on the table card.
 */

import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  ClassifiedCardFace,
  type CardClassification,
} from "@/components/decks/ClassifiedCardFace"
import {
  planArenaHoverPreview,
  type PreviewBox,
} from "@/components/Playtester/board/arenaHoverPreview.logic"
import type { PlayingCardInstance } from "@/components/Playtester/session/playCard.logic"
import { cardArtUrl } from "@/lib/api/decks"

export type ArenaHoverTarget = {
  card: PlayingCardInstance
  anchor: HTMLElement
}

function classificationOf(
  card: PlayingCardInstance
): CardClassification | null {
  if (card.classification === "classified" || card.classification === "top_secret") {
    return card.classification
  }
  if (card.isClassified) return "classified"
  return null
}

export function ArenaCardPreview({ target }: { target: ArenaHoverTarget | null }) {
  const [box, setBox] = useState<PreviewBox | null>(null)

  useLayoutEffect(() => {
    if (!target) {
      setBox(null)
      return
    }
    const anchor = target.anchor
    let frame = 0

    function place() {
      const rect = anchor.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const next = planArenaHoverPreview(
        {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        },
        window.innerWidth,
        window.innerHeight
      )
      setBox((prev) => {
        if (
          prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev
        }
        return next
      })
      frame = window.requestAnimationFrame(place)
    }

    place()
    return () => window.cancelAnimationFrame(frame)
  }, [target])

  if (!target || !box || typeof document === "undefined") return null

  const card = target.card
  const classification = classificationOf(card)
  const artSrc = classification
    ? null
    : cardArtUrl(card.artPath, card.artVersion)

  return createPortal(
    <div
      className="pointer-events-none fixed z-[10000]"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
    >
      {classification ? (
        <ClassifiedCardFace
          name={card.name}
          classification={classification}
          size="enlarge"
        />
      ) : artSrc ? (
        <img
          src={artSrc}
          alt=""
          draggable={false}
          className="h-full w-full border border-cyan-300/50 object-cover shadow-2xl shadow-black/80 clip-angled"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-cyan-300/50 bg-black px-4 text-center font-mono text-sm text-cyan-100 shadow-2xl shadow-black/80 clip-angled">
          {card.name}
        </div>
      )}
    </div>,
    document.body
  )
}
