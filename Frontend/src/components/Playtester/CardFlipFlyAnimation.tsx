/**
 * Card flies between two screen points while flipping.
 *
 * - draw: library → zone  (back → face)
 * - put:  zone → library  (face → back)
 * - faceDown: either direction, already back — slides with no flip
 *
 * Completion must not rely only on transitionend: if from ≈ to (e.g. drop on
 * the battlefield under the cursor), the outer translate never runs and the
 * parent would stay permanently "busy".
 */

import { useEffect, useRef, useState, type TransitionEvent } from "react"

import { sharedImages } from "@/assets/shared"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

import { FLIP_FLY_MODE, type FlipFlyMode } from "./playtesterConstants"
import type { PlayingCardInstance } from "./types"

export type { FlipFlyMode }
export { FLIP_FLY_MODE }

export type CardFlipFlyAnimationProps = {
  card: PlayingCardInstance
  mode: FlipFlyMode
  from: { x: number; y: number; w: number; h: number }
  to: { x: number; y: number }
  onComplete: () => void
}

const FLIP_MS = 550
const faceShell =
  "absolute inset-0 overflow-hidden border bg-black/80 clip-angled [backface-visibility:hidden]"

export function CardFlipFlyAnimation({
  card,
  mode,
  from,
  to,
  onComplete,
}: CardFlipFlyAnimationProps) {
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
    // Always clear the parent lock even if transitionend never fires.
    const timer = window.setTimeout(finish, FLIP_MS + 50)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot per mount
  }, [])

  function onFlyEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "transform") return
    if (event.target !== event.currentTarget) return
    finish()
  }

  const dx = to.x - from.x
  const dy = to.y - from.y

  const backFace = (
    <div className={cn(faceShell, "border-cyan-500/40")}>
      <img
        src={sharedImages.CARD_BACK}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
    </div>
  )

  const frontFace = (
    <div
      className={cn(faceShell, "border-cyan-400/55")}
      aria-label={card.name}
    >
      {faceSrc ? (
        <img
          src={faceSrc}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center px-2 text-center font-mono text-[10px] text-cyan-100/80">
          {card.name}
        </span>
      )}
    </div>
  )

  // faceDown: slide with the back only — no rotateY reveal.
  if (mode === FLIP_FLY_MODE.faceDown) {
    return (
      <div
        className="pointer-events-none fixed z-[90]"
        style={{
          left: from.x,
          top: from.y,
          width: from.w,
          height: from.h,
          transform: active
            ? `translate(${dx}px, ${dy}px)`
            : "translate(0px, 0px)",
          transition: `transform ${FLIP_MS}ms ease-in-out`,
        }}
        onTransitionEnd={onFlyEnd}
      >
        <div className="relative h-full w-full">{backFace}</div>
      </div>
    )
  }

  const startFace = mode === FLIP_FLY_MODE.draw ? backFace : frontFace
  const endFace = mode === FLIP_FLY_MODE.draw ? frontFace : backFace

  return (
    <div
      className="pointer-events-none fixed z-[90]"
      style={{
        left: from.x,
        top: from.y,
        width: from.w,
        height: from.h,
        perspective: 800,
        transform: active
          ? `translate(${dx}px, ${dy}px)`
          : "translate(0px, 0px)",
        transition: `transform ${FLIP_MS}ms ease-in-out`,
      }}
      onTransitionEnd={onFlyEnd}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: active ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: `transform ${FLIP_MS}ms ease-in-out`,
        }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          {startFace}
        </div>
        <div
          className="absolute inset-0 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          {endFace}
        </div>
      </div>
    </div>
  )
}

/** @deprecated Prefer CardFlipFlyAnimation — kept name for older imports. */
export const DrawFlipAnimation = CardFlipFlyAnimation
