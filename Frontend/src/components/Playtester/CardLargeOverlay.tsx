/**
 * Full-viewport card art preview.
 * - Middle-mouse hold: parent sets open while held (no onDismiss).
 * - Context-menu Zoom: pass onDismiss — click backdrop / Escape closes.
 * Portaled to document.body so zone stacking cannot cover it.
 */

import { useEffect } from "react"
import { createPortal } from "react-dom"

import "@/components/decks/DeckCardStack.css"

export type CardEnlargeOverlayProps = {
  open: boolean
  name: string
  artSrc: string | null
  caption?: string
  /** When set, overlay is sticky until backdrop click or Escape. */
  onDismiss?: () => void
}

export function CardEnlargeOverlay({
  open,
  name,
  artSrc,
  onDismiss,
}: CardEnlargeOverlayProps) {
  useEffect(() => {
    if (!open || !onDismiss) return
    const dismiss = onDismiss
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onDismiss])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="deck-card-enlarge"
      role="dialog"
      aria-label={name}
      aria-modal={onDismiss ? true : undefined}
      /* Middle-mouse hold uses pointer-events:none in CSS; sticky Zoom must click. */
      style={onDismiss ? { pointerEvents: "auto", cursor: "zoom-out" } : undefined}
      onClick={onDismiss ? () => onDismiss() : undefined}
      onContextMenu={(event) => {
        event.preventDefault()
        onDismiss?.()
      }}
    >
      {artSrc ? (
        <img
          src={artSrc}
          className="deck-card-enlarge__art clip-angled"
          draggable={false}
          alt=""
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <div
          className="deck-card-enlarge__fallback clip-angled"
          onClick={(event) => event.stopPropagation()}
        >
          {name}
        </div>
      )}
    </div>,
    document.body
  )
}
