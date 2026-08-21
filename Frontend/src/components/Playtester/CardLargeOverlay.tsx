/**
 * Centered card-art peek (middle-mouse hold or sticky Zoom).
 * Sized to read clearly without filling the viewport — see `--enlarge-w`
 * in DeckCardStack.css.
 * Portaled to document.body so zone stacking cannot cover it.
 */

import { useEffect } from "react"
import { createPortal } from "react-dom"

import {
  ClassifiedCardFace,
  type CardClassification,
} from "@/components/decks/ClassifiedCardFace"
import "@/components/decks/DeckCardStack.css"

export type CardEnlargeOverlayProps = {
  open: boolean
  name: string
  artSrc: string | null
  caption?: string
  /** Preview / unpublished stub — redacted face. */
  classification?: CardClassification | null
  /** When set, overlay is sticky until backdrop click or Escape. */
  onDismiss?: () => void
}

export function CardEnlargeOverlay({
  open,
  name,
  artSrc,
  classification = null,
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

  const label =
    classification === "top_secret"
      ? `${name} — TOP SECRET`
      : classification === "classified"
        ? `${name} — CLASSIFIED`
        : name

  return createPortal(
    <div
      className="deck-card-enlarge"
      role="dialog"
      aria-label={label}
      aria-modal={onDismiss ? true : undefined}
      /* Middle-mouse hold uses pointer-events:none in CSS; sticky Zoom must click. */
      style={onDismiss ? { pointerEvents: "auto", cursor: "zoom-out" } : undefined}
      onClick={onDismiss ? () => onDismiss() : undefined}
      onContextMenu={(event) => {
        event.preventDefault()
        onDismiss?.()
      }}
    >
      {classification ? (
        <div onClick={(event) => event.stopPropagation()}>
          <ClassifiedCardFace
            name={name}
            classification={classification}
            size="enlarge"
          />
        </div>
      ) : artSrc ? (
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
