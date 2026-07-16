/**
 * Dedicated visual Pilot slot (uses a "Pilot" deck category under the hood).
 */

import { useState, type DragEvent } from "react"

import {
  isDeckCardDrag,
  parseDeckCardDrag,
  type DeckCardDragPayload,
} from "@/components/decks/DeckCardStack"
import "@/components/decks/DeckCardStack.css"
import { cardArtUrl, type DeckCardEntry } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

type DeckPilotSlotProps = {
  pilot: DeckCardEntry | null
  canEdit: boolean
  disabled?: boolean
  onDropCard: (payload: DeckCardDragPayload) => void | Promise<void>
  onClear?: () => void | Promise<void>
  onEnlarge?: (card: DeckCardEntry) => void
}

export function DeckPilotSlot({
  pilot,
  canEdit,
  disabled = false,
  onDropCard,
  onClear,
  onEnlarge,
}: DeckPilotSlotProps) {
  const [dropActive, setDropActive] = useState(false)
  const acceptsDrops = canEdit && !disabled
  const art = pilot ? cardArtUrl(pilot.card_art_path) : null

  function isCardDrag(event: DragEvent): boolean {
    return isDeckCardDrag(event)
  }

  function parsePayload(event: DragEvent): DeckCardDragPayload | null {
    return parseDeckCardDrag(event)
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-2 p-1">
      <h2 className="font-buahs93 text-lg tracking-wide text-white">Pilot</h2>
      <div
        className={cn(
          "deck-card-frame relative flex items-center justify-center border border-dashed border-cyan-500/30 bg-black/30 transition-[border-color,background-color] duration-150",
          "clip-angled [--angle:15px]",
          dropActive && "border-cyan-400/60 bg-cyan-500/10",
          disabled && "opacity-50"
        )}
        onDragEnter={(event) => {
          if (!acceptsDrops || !isCardDrag(event)) return
          event.preventDefault()
          setDropActive(true)
        }}
        onDragOver={(event) => {
          if (!acceptsDrops || !isCardDrag(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = "move"
          setDropActive(true)
        }}
        onDragLeave={(event) => {
          const related = event.relatedTarget as Node | null
          if (related && event.currentTarget.contains(related)) return
          setDropActive(false)
        }}
        onDrop={(event) => {
          if (!acceptsDrops) return
          event.preventDefault()
          setDropActive(false)
          const payload = parsePayload(event)
          if (!payload) return
          void onDropCard(payload)
        }}
        onMouseDown={(event) => {
          if (!pilot || event.button !== 1) return
          event.preventDefault()
          onEnlarge?.(pilot)
        }}
        onContextMenu={(event) => {
          if (!canEdit || !pilot || !onClear) return
          event.preventDefault()
          void onClear()
        }}
        title={
          pilot
            ? canEdit
              ? `${pilot.card_name} — right-click to clear · middle-hold enlarge`
              : pilot.card_name
            : canEdit
              ? "Drop a pilot card here"
              : "No pilot selected"
        }
      >
        {pilot ? (
          art ? (
            <img
              src={art}
              alt={pilot.card_name}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <p className="px-3 text-center font-mono text-xs text-cyan-200/80">
              {pilot.card_name}
            </p>
          )
        ) : (
          <p className="px-4 text-center font-mono text-[10px] leading-relaxed text-white/35">
            {canEdit ? "Drop pilot card here" : "Empty"}
          </p>
        )}
      </div>
    </div>
  )
}
