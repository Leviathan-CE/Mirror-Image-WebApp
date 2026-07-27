/**
 * Full-viewport card art preview (middle-mouse hold).
 * Portaled to document.body so zone stacking (hand z-40, counters, etc.)
 * cannot paint over the enlarge layer.
 */

import { createPortal } from "react-dom"

import "@/components/decks/DeckCardStack.css"

export type CardEnlargeOverlayProps = {
  open: boolean
  name: string
  artSrc: string | null
  caption?: string
}

export function CardEnlargeOverlay({
  open,
  name,
  artSrc,
}: CardEnlargeOverlayProps) {
  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="deck-card-enlarge" role="dialog" aria-label={name}>
      {artSrc ? (
        <img
          src={artSrc}
          className="deck-card-enlarge__art clip-angled"
          draggable={false}
          alt=""
        />
      ) : (
        <div className="deck-card-enlarge__fallback clip-angled">{name}</div>
      )}
    </div>,
    document.body
  )
}
