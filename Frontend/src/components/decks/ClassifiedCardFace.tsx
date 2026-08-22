/**
 * Restricted / redacted card faces for cards the viewer cannot fully see.
 *
 * - classified — preview status without entitlement (subscribe CTA)
 * - top_secret — not published (coming soon to preview; no CTA)
 */

import type { CSSProperties } from "react"
import { Link } from "react-router-dom"

import {
  CLASSIFIED_EYEBROW,
  CLASSIFIED_STAMP,
  CLASSIFIED_SUBSCRIBE_CTA,
  TOP_SECRET_FOOTER,
} from "@/components/decks/constants"
import { ROUTES } from "@/lib/route"
import { cn } from "@/lib/utils"

export type CardClassification = "classified" | "top_secret"

export function cardClassification(card: {
  classification?: string | null
  is_classified?: boolean
}): CardClassification | null {
  if (card.classification === "classified" || card.classification === "top_secret") {
    return card.classification
  }
  if (card.is_classified === true) return "classified"
  return null
}

export function isClassifiedCard(card: {
  classification?: string | null
  is_classified?: boolean
}): boolean {
  return cardClassification(card) != null
}

/** Stable hash so the same card name always gets the same flicker timing. */
export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Per-card CSS custom properties for desynced redact flicker. */
export type FlickerStyle = CSSProperties & {
  "--flicker-duration": string
  "--flicker-delay": string
}

/** Per-card CSS vars so redact bars don't sync across the board. */
export function flickerStyleForSeed(seed: string): FlickerStyle {
  const h = hashSeed(seed)
  // Long cycle = long pause between short blinks (randomized per card).
  const duration = 9 + (h % 7000) / 1000 // 9s – 16s
  // Negative delay = start mid-cycle at a unique phase.
  const delay = -((h >>> 8) % 14000) / 1000 // 0s – −14s
  return {
    "--flicker-duration": `${duration.toFixed(3)}s`,
    "--flicker-delay": `${delay.toFixed(3)}s`,
  }
}

type ClassifiedCardFaceProps = {
  name: string
  classification?: CardClassification
  /** Compact stack tile vs enlarge / pilot panel. */
  size?: "stack" | "enlarge" | "pilot"
  className?: string
}

export function ClassifiedCardFace({
  name,
  classification = "classified",
  size = "stack",
  className,
}: ClassifiedCardFaceProps) {
  const isEnlarge = size === "enlarge"
  const isTopSecret = classification === "top_secret"
  // Stack tiles are overlapped — CTA lives in sticky zoom (left-click).
  const showFooter = size !== "stack"
  const flickerStyle = flickerStyleForSeed(`${classification}:${name}`)

  return (
    <div
      className={cn(
        "classified-card-face clip-angled",
        isTopSecret && "classified-card-face--top-secret",
        isEnlarge && "classified-card-face--enlarge",
        size === "pilot" && "classified-card-face--pilot",
        className
      )}
      style={flickerStyle}
    >
      <div className="classified-card-face__scan" aria-hidden />
      <div className="classified-card-face__corners" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="classified-card-face__redact" aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <p className="classified-card-face__eyebrow">
        {isTopSecret
          ? CLASSIFIED_EYEBROW.top_secret
          : CLASSIFIED_EYEBROW.classified}
      </p>

      <div className="classified-card-face__stamp">
        <span className="classified-card-face__stamp-ring" aria-hidden />
        <span className="classified-card-face__tag font-glitch">
          {isTopSecret
            ? CLASSIFIED_STAMP.top_secret
            : CLASSIFIED_STAMP.classified}
        </span>
      </div>

      <p className="classified-card-face__name">{name}</p>

      {showFooter ? (
        isTopSecret ? (
          <span className="classified-card-face__soon font-buahs93">
            {TOP_SECRET_FOOTER}
          </span>
        ) : (
          <Link
            to={ROUTES.SUBSCRIBE}
            className="clip-angled classified-card-face__cta font-buahs93"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {CLASSIFIED_SUBSCRIBE_CTA}
          </Link>
        )
      ) : (
        <span className="classified-card-face__hint font-mono">
          {isTopSecret ? "Click to inspect" : "Click for access"}
        </span>
      )}
    </div>
  )
}
