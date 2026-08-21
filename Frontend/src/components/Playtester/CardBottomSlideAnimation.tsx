/**
 * Slide/tuck a face-up card toward the deck and under the pile.
 * Visually distinct from draw (back→face) and put-on-top (face→back flip).
 */

import { useEffect, useRef, useState, type TransitionEvent } from "react"

import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

import type { PlayingCardInstance } from "./types"

export type CardBottomSlideAnimationProps = {
  card: PlayingCardInstance
  from: { x: number; y: number; w: number; h: number }
  /** Deck pile top-left (approx). */
  to: { x: number; y: number }
  onComplete: () => void
}

const SLIDE_MS = 620

export function CardBottomSlideAnimation({
  card,
  from,
  to,
  onComplete,
}: CardBottomSlideAnimationProps) {
  const [active, setActive] = useState(false)
  const doneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const faceSrc = cardArtUrl(card.artPath, card.artVersion)

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    onCompleteRef.current()
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setActive(true))
    const timer = window.setTimeout(finish, SLIDE_MS + 80)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot per mount
  }, [])

  function onSlideEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "transform") return
    if (event.target !== event.currentTarget) return
    finish()
  }

  // Tuck under: end lower than the pile top and slightly smaller / faded.
  const dx = to.x - from.x + 10
  const dy = to.y - from.y + from.h * 0.45

  return (
    <div
      className="pointer-events-none fixed z-[90]"
      style={{
        left: from.x,
        top: from.y,
        width: from.w,
        height: from.h,
        transform: active
          ? `translate(${dx}px, ${dy}px) scale(0.72)`
          : "translate(0px, 0px) scale(1)",
        opacity: active ? 0.35 : 1,
        transition: `transform ${SLIDE_MS}ms cubic-bezier(0.4, 0.05, 0.2, 1), opacity ${SLIDE_MS}ms ease-out`,
        zIndex: active ? 5 : 90,
      }}
      onTransitionEnd={onSlideEnd}
    >
      <div
        className={cn(
          "h-full w-full overflow-hidden border border-cyan-400/50 bg-black/80",
          "clip-angled shadow-lg shadow-black/40"
        )}
      >
        {faceSrc ? (
          <img
            src={faceSrc}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-1 text-center font-mono text-[10px] text-cyan-100/80">
            {card.name}
          </span>
        )}
      </div>
    </div>
  )
}
