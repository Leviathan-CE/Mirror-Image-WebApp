/**
 * Single playtester card face.
 * Face-up / face-down uses a CSS 3D rotateY flip (same idea as draw/put fly).
 * When `onCounterAdjust` is set, counter badges accept:
 *   left-click  → +1
 *   right-click → −1
 */

import type { ReactNode } from "react"

import { sharedImages } from "@/assets/shared"
import { GameIcon } from "@/components/common/GameIcon"
import { ClassifiedCardFace } from "@/components/decks/ClassifiedCardFace"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

import type { CardCounterKind, PlayingCardInstance } from "./types"

const FLIP_MS = 450

const faceShell =
  "absolute inset-0 overflow-hidden border bg-black/70 clip-angled [backface-visibility:hidden]"

export type PlayingCardProps = {
  card: PlayingCardInstance
  className?: string
  isSelected?: boolean
  isExpended?: boolean
  /** Left-click +1 / right-click −1 on a counter badge. */
  onCounterAdjust?: (kind: CardCounterKind, delta: number) => void
}

export function PlayingCard({
  card,
  className,
  isSelected,
  onCounterAdjust,
}: PlayingCardProps) {
  const faceDown = Boolean(card.faceDown)
  const classification = card.classification ?? (card.isClassified ? "classified" : null)
  const classified = classification != null
  const faceSrc = classified
    ? null
    : cardArtUrl(card.artPath, card.artVersion)
  const time = card.timeCounters ?? 0
  const damage = card.damageCounters ?? 0
  const tlv = card.tlvCounters ?? 0
  const hasCounters = time > 0 || damage > 0 || tlv > 0
  const interactive = Boolean(onCounterAdjust)

  function adjust(kind: CardCounterKind, delta: number) {
    onCounterAdjust?.(kind, delta)
  }

  const borderClass =
    classification === "top_secret"
      ? "border-amber-400/50"
      : classification === "classified"
        ? "border-red-400/50"
        : "border-cyan-500/35"
  const selectedBorder =
    classification === "top_secret"
      ? "border-amber-300/90"
      : classification === "classified"
        ? "border-red-300/90"
        : "border-cyan-300/90"

  return (
    <div
      className={cn(
        "relative h-36 w-28 shrink-0 [perspective:800px]",
        className
      )}
      aria-label={
        faceDown
          ? `${card.name} (face down)`
          : classification === "top_secret"
            ? `${card.name} (top secret)`
            : classification === "classified"
              ? `${card.name} (classified)`
              : card.name
      }
    >
      <div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{
          transform: faceDown ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: `transform ${FLIP_MS}ms ease-in-out`,
        }}
      >
        {/* Front (art) */}
        <div
          className={cn(
            faceShell,
            borderClass,
            isSelected && selectedBorder
          )}
        >
          {classification ? (
            <ClassifiedCardFace
              name={card.name}
              classification={classification}
              size="stack"
              className="!rounded-none"
            />
          ) : faceSrc ? (
            <img
              src={faceSrc}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-full items-center justify-center px-2 text-center font-mono text-[10px] text-cyan-100/80">
              {card.name}
            </span>
          )}

          {!classified && hasCounters ? (
            <div className="absolute top-1 right-1 bottom-1 flex flex-col items-end justify-end gap-1">
              {time > 0 ? (
                <CounterBadge
                  kind="time"
                  count={time}
                  interactive={interactive}
                  className="border-emerald-400/70 bg-emerald-950/90 text-emerald-200"
                  label="Time"
                  onAdjust={adjust}
                >
                  {time}
                </CounterBadge>
              ) : null}
              {damage > 0 ? (
                <CounterBadge
                  kind="damage"
                  count={damage}
                  interactive={interactive}
                  className="border-red-400/70 bg-red-950/90 text-red-200"
                  label="Damage"
                  onAdjust={adjust}
                >
                  {damage}
                </CounterBadge>
              ) : null}
              {tlv > 0 ? (
                <CounterBadge
                  kind="tlv"
                  count={tlv}
                  interactive={interactive}
                  className="border-amber-400/70 bg-black/85 text-amber-100"
                  label="TLV"
                  onAdjust={adjust}
                >
                  <GameIcon name="threat_lvl" className="h-4 w-auto" />
                  {tlv}
                </CounterBadge>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Back */}
        <div
          className={cn(
            faceShell,
            "border-cyan-500/40",
            isSelected && "border-cyan-300/90"
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
          <img
            src={sharedImages.CARD_BACK}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}

type CounterBadgeProps = {
  kind: CardCounterKind
  count: number
  interactive: boolean
  className: string
  label: string
  onAdjust: (kind: CardCounterKind, delta: number) => void
  children: ReactNode
}

function CounterBadge({
  kind,
  count,
  interactive,
  className,
  label,
  onAdjust,
  children,
}: CounterBadgeProps) {
  const title = interactive
    ? `${label}: ${count} · left-click +1 · right-click −1`
    : `${label} counters: ${count}`

  return (
    <span
      data-counter-badge=""
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={title}
      className={cn(
        "inline-flex min-h-7 min-w-7 items-center justify-center gap-1 border px-1.5 font-glitch text-base leading-none",
        interactive
          ? "pointer-events-auto cursor-pointer select-none"
          : "pointer-events-none",
        className
      )}
      onPointerDown={(event) => {
        if (!interactive) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        if (!interactive) return
        event.preventDefault()
        event.stopPropagation()
        onAdjust(kind, 1)
      }}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onContextMenu={(event) => {
        if (!interactive) return
        event.preventDefault()
        event.stopPropagation()
        onAdjust(kind, -1)
      }}
      onKeyDown={(event) => {
        if (!interactive) return
        if (event.key === "Enter" || event.key === "+") {
          event.preventDefault()
          onAdjust(kind, 1)
        } else if (event.key === "-" || event.key === "Backspace") {
          event.preventDefault()
          onAdjust(kind, -1)
        }
      }}
    >
      {children}
    </span>
  )
}
