/**
 * Dedicated visual Pilot slot (uses a "Pilot" deck category under the hood).
 */

import { useEffect, useState, type DragEvent } from "react"

import {
  ClassifiedCardFace,
  cardClassification,
} from "@/components/decks/ClassifiedCardFace"
import {
  deckCardDropEffect,
  isDeckCardDrag,
  parseDeckCardDrag,
  type DeckCardDragPayload,
} from "@/components/decks/deckCardDrag"
import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import "@/components/decks/DeckCardStack.css"
import { cardArtUrl, type DeckCardEntry } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

type DeckPilotSlotProps = {
  pilot: DeckCardEntry | null
  canEdit: boolean
  disabled?: boolean
  onDropCard: (payload: DeckCardDragPayload) => void | Promise<void>
  onClear?: () => void | Promise<void>
}

export function DeckPilotSlot({
  pilot,
  canEdit,
  disabled = false,
  onDropCard,
  onClear,
}: DeckPilotSlotProps) {
  const [dropActive, setDropActive] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const [inspectOpen, setInspectOpen] = useState(false)
  const acceptsDrops = canEdit && !disabled
  const classification = pilot ? cardClassification(pilot) : null
  const classified = classification != null
  const art =
    pilot && !classified
      ? cardArtUrl(pilot.card_art_path, pilot.card_art_version)
      : null

  useEffect(() => {
    if (!enlarged) return

    function release() {
      setEnlarged(false)
    }

    window.addEventListener("mouseup", release)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("mouseup", release)
      window.removeEventListener("blur", release)
    }
  }, [enlarged])

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
          "deck-card-frame deck-pilot-slot__card relative flex items-center justify-center border border-dashed border-cyan-500/30 bg-black/30",
          dropActive && "border-cyan-400/60 bg-cyan-500/10",
          disabled && "opacity-50",
          pilot && "has-pilot",
          hovered && pilot && "is-hovered"
        )}
        onDragEnter={(event) => {
          if (!acceptsDrops || !isCardDrag(event)) return
          event.preventDefault()
          setDropActive(true)
        }}
        onDragOver={(event) => {
          if (!acceptsDrops || !isCardDrag(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = deckCardDropEffect()
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
        onMouseEnter={() => {
          if (pilot) setHovered(true)
        }}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={(event) => {
          if (!pilot || event.button !== 1) return
          event.preventDefault()
          setEnlarged(true)
        }}
        onClick={(event) => {
          if (!pilot || !classified || event.button !== 0) return
          event.preventDefault()
          setInspectOpen(true)
        }}
        onAuxClick={(event) => {
          if (event.button === 1) event.preventDefault()
        }}
        onContextMenu={(event) => {
          if (!canEdit || !pilot || !onClear) return
          event.preventDefault()
          void onClear()
        }}
        title={
          pilot
            ? classification === "top_secret"
              ? `${pilot.card_name} — TOP SECRET · click to inspect`
              : classification === "classified"
                ? `${pilot.card_name} — CLASSIFIED · click for details / become a member`
              : canEdit
                ? `${pilot.card_name} — right-click to clear · middle-hold enlarge`
                : `${pilot.card_name} — middle-click hold to enlarge`
            : canEdit
              ? "Drop a pilot card here"
              : "No pilot selected"
        }
      >
        {pilot ? (
          classified ? (
            <ClassifiedCardFace
              name={pilot.card_name}
              classification={classification!}
              size="pilot"
            />
          ) : art ? (
            <img
              src={art}
              alt={pilot.card_name}
              className="deck-pilot-slot__art clip-angled"
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

      {enlarged && pilot ? (
        <div
          className="deck-card-enlarge"
          role="dialog"
          aria-label={pilot.card_name}
        >
          {classified ? (
            <ClassifiedCardFace
              name={pilot.card_name}
              classification={classification!}
              size="enlarge"
            />
          ) : art ? (
            <img
              src={art}
              alt={pilot.card_name}
              className="deck-card-enlarge__art clip-angled"
              draggable={false}
            />
          ) : (
            <div className="deck-card-enlarge__fallback clip-angled">
              {pilot.card_name}
            </div>
          )}
          <p className="deck-card-enlarge__caption">
            {pilot.card_name}
            {classification === "top_secret" ? " — TOP SECRET" : classification === "classified" ? " — CLASSIFIED" : ""}
          </p>
        </div>
      ) : null}

      <CardEnlargeOverlay
        open={inspectOpen && pilot != null && classified}
        name={pilot?.card_name ?? ""}
        artSrc={null}
        classification={classification}
        onDismiss={() => setInspectOpen(false)}
      />
    </div>
  )
}
