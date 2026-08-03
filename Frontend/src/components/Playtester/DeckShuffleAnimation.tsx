/**
 * Riffle shuffle on the deck pile: card backs split left/right, then merge back.
 * Two passes, alternating which side leads.
 */

import { useEffect, useRef, useState } from "react"

import { sharedImages } from "@/assets/shared"
import { cn } from "@/lib/utils"

export type DeckShuffleAnimationProps = {
  /** Deck pile rect the riffle plays over. */
  from: { x: number; y: number; w: number; h: number }
  onComplete: () => void
}

const CARD_COUNT = 6
const STEP_MS = 190
/** split → merge → split → merge */
const STEPS = 4

export function DeckShuffleAnimation({
  from,
  onComplete,
}: DeckShuffleAnimationProps) {
  const [step, setStep] = useState(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const timers = Array.from({ length: STEPS }, (_, i) =>
      window.setTimeout(() => setStep(i + 1), (i + 1) * STEP_MS)
    )
    const done = window.setTimeout(
      () => onCompleteRef.current(),
      STEPS * STEP_MS + 140
    )
    return () => {
      for (const t of timers) window.clearTimeout(t)
      window.clearTimeout(done)
    }
  }, [])

  const split = step % 2 === 1
  /** Second pass leads with the opposite side. */
  const pass = step >= 3 ? -1 : 1

  return (
    <div
      className="pointer-events-none fixed z-[90]"
      style={{
        left: from.x,
        top: from.y,
        width: from.w,
        height: from.h,
      }}
    >
      {Array.from({ length: CARD_COUNT }, (_, i) => {
        const side = (i % 2 === 0 ? 1 : -1) * pass
        const spread = 16 + i * 4
        const rise = 6 + i * 3
        const tilt = 3 + i * 1.5
        return (
          <div
            key={`riffle-${i}`}
            className="absolute inset-0"
            style={{
              transform: split
                ? `translate(${side * spread}px, ${-rise}px) rotate(${side * tilt}deg)`
                : "translate(0px, 0px) rotate(0deg)",
              transition: `transform ${STEP_MS}ms cubic-bezier(0.35, 0, 0.3, 1)`,
              zIndex: CARD_COUNT - i,
            }}
          >
            <div
              className={cn(
                "h-full w-full overflow-hidden border border-cyan-400/45 bg-black/80",
                "clip-angled shadow-md shadow-black/50"
              )}
            >
              <img
                src={sharedImages.CARD_BACK}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
