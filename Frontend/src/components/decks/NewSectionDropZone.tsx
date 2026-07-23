/**
 * Empty grid cell: drop a card here to create a new section and move it in.
 */

import { useState, type DragEvent } from "react"

import {
  isDeckCardDrag,
  parseDeckCardDrag,
  type DeckCardDragPayload,
} from "@/components/decks/DeckCardStack"
import { cn } from "@/lib/utils"

type NewSectionDropZoneProps = {
  disabled?: boolean
  onDropCard: (payload: DeckCardDragPayload) => void | Promise<void>
}

export function NewSectionDropZone({
  disabled = false,
  onDropCard,
}: NewSectionDropZoneProps) {
  const [dropActive, setDropActive] = useState(false)

  function isCardDrag(event: DragEvent): boolean {
    return isDeckCardDrag(event)
  }

  function parsePayload(event: DragEvent): DeckCardDragPayload | null {
    return parseDeckCardDrag(event)
  }

  return (
    <div
      className={cn(
        "deck-board__slot flex min-h-[12rem] flex-col items-center justify-center border border-dashed border-cyan-500/25 px-2 py-6",
        "bg-black/25 transition-[border-color,background-color,color] duration-150",
        dropActive && "border-cyan-400/60 bg-cyan-500/10",
        disabled && "pointer-events-none opacity-50"
      )}
      onDragEnter={(event) => {
        if (disabled || !isCardDrag(event)) return
        event.preventDefault()
        setDropActive(true)
      }}
      onDragOver={(event) => {
        if (disabled || !isCardDrag(event)) return
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
        if (disabled) return
        event.preventDefault()
        setDropActive(false)
        const payload = parsePayload(event)
        if (!payload) return
        void onDropCard(payload)
      }}
    >
      <p className="font-buahs93 text-sm tracking-wide text-cyan-200/70">
        NEW SECTION
      </p>
      <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-white/35">
        Drop a card here to create a section
      </p>
    </div>
  )
}
