/**
 * Collapsible pilot strip — Archidekt-style tab on the table edge.
 * Only as wide/tall as the pilot card; slides in/out on click.
 *
 * A fixed invisible hit box keeps pilot drag/drop working even when the
 * panel is tucked under the edge (same rect the fixed hand-row slot used).
 */

import type { RefObject, ReactNode } from "react"

import {
  PILOT_PILE,
  type PilotSidebarSide,
} from "@/components/Playtester/playtesterConstants"
import { TrashyardPile } from "@/components/Playtester/TrashyardPile"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { cn } from "@/lib/utils"

export type { PilotSidebarSide }

export type PilotSidebarProps = {
  side?: PilotSidebarSide
  open: boolean
  onOpenChange: (open: boolean) => void
  pilotRef?: RefObject<HTMLDivElement | null>
  cards: PlayingCardInstance[]
  onReleaseCard: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  onCardContextMenu?: (
    instanceId: string,
    clientX: number,
    clientY: number
  ) => void
  onToggleExpended?: (instanceId: string) => void
  cardOverlay?: ReactNode
  readOnly?: boolean
  pileLabel?: string
  /** Screen-edge anchor — lines up with the local or opponent hand band. */
  className?: string
}

function closedOffset(side: PilotSidebarSide): string {
  return side === "right"
    ? `translateX(${PILOT_PILE.w}px)`
    : `translateX(-${PILOT_PILE.w}px)`
}

export function PilotSidebar({
  side = "right",
  open,
  onOpenChange,
  pilotRef,
  cards,
  onReleaseCard,
  onCardContextMenu,
  onToggleExpended,
  cardOverlay,
  readOnly = false,
  pileLabel = "Pilot",
  className,
}: PilotSidebarProps) {
  const pilotName = cards[0]?.name
  const chevronClosed = side === "right" ? "‹" : "›"
  const chevronOpen = side === "right" ? "›" : "‹"

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30 flex items-center",
        side === "right" ? "right-0" : "left-0",
        className
      )}
    >
      {!readOnly && pilotRef ? (
        <div
          ref={pilotRef}
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{
            width: PILOT_PILE.w,
            height: PILOT_PILE.h,
            ...(side === "right"
              ? { right: PILOT_PILE.tabW }
              : { left: PILOT_PILE.tabW }),
          }}
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "pointer-events-none flex items-center transition-transform duration-300 ease-in-out",
          side === "right" ? "flex-row" : "flex-row-reverse"
        )}
        style={{
          width: PILOT_PILE.w + PILOT_PILE.tabW,
          transform: open ? "translateX(0)" : closedOffset(side),
        }}
        aria-label={`${pileLabel} panel`}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-label={
            open
              ? `Hide ${pileLabel.toLowerCase()}`
              : `Show ${pileLabel.toLowerCase()}`
          }
          title={
            open
              ? `Hide ${pileLabel.toLowerCase()}`
              : pilotName
                ? `${pileLabel} · ${pilotName}`
                : pileLabel
          }
          className={cn(
            "pointer-events-auto flex shrink-0 flex-col items-center justify-center gap-0.5",
            "h-20 border border-cyan-500/40 bg-black/85 font-mono text-[10px] text-cyan-100",
            "hover:bg-cyan-950/90",
            side === "right" ? "border-r-0" : "border-l-0"
          )}
          style={{ width: PILOT_PILE.tabW }}
          onClick={() => onOpenChange(!open)}
        >
          <span className="text-sm leading-none" aria-hidden>
            {open ? chevronOpen : chevronClosed}
          </span>
          {!open && pilotName ? (
            <span className="max-h-12 truncate text-[7px] leading-tight [writing-mode:vertical-rl]">
              {pilotName}
            </span>
          ) : null}
        </button>

        <div
          className={cn(
            "pointer-events-auto shrink-0 border-cyan-500/25 bg-black/80 py-0.5",
            side === "right" ? "border-l pr-0.5 pl-0" : "border-r pr-0 pl-0.5"
          )}
          style={{ width: PILOT_PILE.w }}
        >
          <TrashyardPile
            cards={cards}
            label={pileLabel}
            size="lg"
            onReleaseCard={readOnly ? () => undefined : onReleaseCard}
            onCardContextMenu={readOnly ? undefined : onCardContextMenu}
            onToggleExpended={readOnly ? undefined : onToggleExpended}
            cardOverlay={readOnly ? undefined : cardOverlay}
          />
        </div>
      </div>
    </div>
  )
}
