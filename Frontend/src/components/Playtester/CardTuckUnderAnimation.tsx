/**
 * Top-of-deck card lifts above the pile, then slides back down and tucks under it.
 * Used when putting cards from the top of the deck on the bottom (stays face down).
 */

import { useEffect, useRef, useState } from "react"

import { sharedImages } from "@/assets/shared"
import { cn } from "@/lib/utils"

export type CardTuckUnderAnimationProps = {
  /** Deck pile rect the card starts on. */
  from: { x: number; y: number; w: number; h: number }
  onComplete: () => void
}

const LIFT_MS = 240
const TUCK_MS = 360

type Phase = "start" | "lifted" | "tucked"

export function CardTuckUnderAnimation({
  from,
  onComplete,
}: CardTuckUnderAnimationProps) {
  const [phase, setPhase] = useState<Phase>("start")
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("lifted"))
    const tuck = window.setTimeout(() => setPhase("tucked"), LIFT_MS)
    const done = window.setTimeout(
      () => onCompleteRef.current(),
      LIFT_MS + TUCK_MS + 60
    )
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(tuck)
      window.clearTimeout(done)
    }
  }, [])

  const lift = Math.round(from.h * 0.6)
  const tuck = Math.round(from.h * 0.45)
  const tucked = phase === "tucked"

  return (
    <div
      className="pointer-events-none fixed"
      style={{
        left: from.x,
        top: from.y,
        width: from.w,
        height: from.h,
        transform: tucked
          ? `translate(10px, ${tuck}px) scale(0.72)`
          : phase === "lifted"
            ? `translate(0px, ${-lift}px) scale(1.02)`
            : "translate(0px, 0px) scale(1)",
        opacity: tucked ? 0.3 : 1,
        transition: tucked
          ? `transform ${TUCK_MS}ms cubic-bezier(0.4, 0.05, 0.2, 1), opacity ${TUCK_MS}ms ease-out`
          : `transform ${LIFT_MS}ms ease-out`,
        // Drop below the pile once it starts tucking so it reads as "underneath".
        zIndex: tucked ? 5 : 90,
      }}
    >
      <div
        className={cn(
          "h-full w-full overflow-hidden border border-cyan-400/50 bg-black/80",
          "clip-angled shadow-lg shadow-black/40"
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
}
