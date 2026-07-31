/**
 * One-time opening mulligan: pick hand cards to bottom, then redraw that many.
 * Middle-mouse hold and right-click → Zoom use the same enlarge overlay as play.
 */

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react"

import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import { PlayingCard } from "@/components/Playtester/PlayingCard"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { ContextMenu } from "@/components/ui/ContextMenu"
import type { DropdownMenuItem } from "@/components/ui/DropdownMenu"
import { cardArtUrl } from "@/lib/api/decks"
import { cn } from "@/lib/utils"

export type MulliganModalProps = {
  hand: PlayingCardInstance[]
  onConfirm: (selectedInstanceIds: string[]) => void
}

type CtxMenuState = {
  card: PlayingCardInstance
  x: number
  y: number
}

export function MulliganModal({ hand, onConfirm }: MulliganModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  /** Middle-mouse hold zoom (clears on pointerup). */
  const [heldZoom, setHeldZoom] = useState<PlayingCardInstance | null>(null)
  /** Sticky zoom from context menu. */
  const [inspectCard, setInspectCard] = useState<PlayingCardInstance | null>(
    null
  )
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)

  const selectedCount = selected.size
  const orderedSelected = useMemo(
    () =>
      hand.filter((c) => selected.has(c.instanceId)).map((c) => c.instanceId),
    [hand, selected]
  )

  const zoomCard = inspectCard ?? heldZoom

  function toggle(instanceId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(instanceId)) next.delete(instanceId)
      else next.add(instanceId)
      return next
    })
  }

  function onCardPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    card: PlayingCardInstance
  ) {
    if (event.button === 1) {
      event.preventDefault()
      event.stopPropagation()
      setHeldZoom(card)
      const release = () => {
        setHeldZoom(null)
        window.removeEventListener("pointerup", release)
        window.removeEventListener("blur", release)
      }
      window.addEventListener("pointerup", release)
      window.addEventListener("blur", release)
    }
  }

  const ctxMenuItems: DropdownMenuItem[] = ctxMenu
    ? [
        {
          id: "view-details",
          label: "View Details",
          onSelect: () => setInspectCard(ctxMenu.card),
        },
      ]
    : []

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-label="Opening mulligan"
    >
      <div className="w-full max-w-3xl border border-cyan-500/35 bg-black/95 p-4 shadow-xl">
        <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
          Mulligan
        </h2>
        <p className="mt-1 font-mono text-[11px] text-cyan-100/60">
          Select any cards to put on the bottom of your deck. You will draw the
          same number from the top. One chance only. Middle-mouse or right-click
          → View Details to zoom.
        </p>

        {hand.length === 0 ? (
          <p className="mt-6 font-mono text-xs text-white/40">Hand is empty.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap justify-center gap-3">
            {hand.map((card) => {
              const isOn = selected.has(card.instanceId)
              return (
                <li key={card.instanceId}>
                  <button
                    type="button"
                    title={
                      isOn
                        ? `${card.name} — selected for bottom`
                        : `${card.name} — click to select`
                    }
                    className={cn(
                      "rounded-none transition-transform",
                      isOn
                        ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-black"
                        : "opacity-90 hover:-translate-y-1"
                    )}
                    onClick={() => toggle(card.instanceId)}
                    onPointerDown={(event) => onCardPointerDown(event, card)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setCtxMenu({
                        card,
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }}
                  >
                    <PlayingCard
                      card={card}
                      className="h-36 w-28"
                      isSelected={isOn}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-3 text-center font-mono text-[10px] text-cyan-100/50">
          {selectedCount === 0
            ? "No cards selected — keep this hand"
            : `Bottom ${selectedCount}, then draw ${selectedCount}`}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="font-buahs93 border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-100"
            onClick={() => onConfirm(orderedSelected)}
          >
            {selectedCount === 0 ? "Keep hand" : "Confirm mulligan"}
          </button>
        </div>
      </div>

      <ContextMenu
        open={Boolean(ctxMenu)}
        x={ctxMenu?.x ?? 0}
        y={ctxMenu?.y ?? 0}
        items={ctxMenuItems}
        onClose={() => setCtxMenu(null)}
        label="Mulligan card actions"
      />

      <CardEnlargeOverlay
        open={zoomCard != null}
        name={zoomCard?.name ?? ""}
        artSrc={
          zoomCard ? cardArtUrl(zoomCard.artPath, zoomCard.artVersion) : null
        }
        onDismiss={inspectCard ? () => setInspectCard(null) : undefined}
      />
    </div>
  )
}
