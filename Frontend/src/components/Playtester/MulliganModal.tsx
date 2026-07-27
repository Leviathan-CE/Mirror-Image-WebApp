/**
 * One-time opening mulligan: pick hand cards to bottom, then redraw that many.
 */

import { useMemo, useState } from "react"

import { PlayingCard } from "@/components/Playtester/PlayingCard"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { cn } from "@/lib/utils"

export type MulliganModalProps = {
  hand: PlayingCardInstance[]
  onConfirm: (selectedInstanceIds: string[]) => void
}

export function MulliganModal({ hand, onConfirm }: MulliganModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const selectedCount = selected.size
  const orderedSelected = useMemo(
    () => hand.filter((c) => selected.has(c.instanceId)).map((c) => c.instanceId),
    [hand, selected]
  )

  function toggle(instanceId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(instanceId)) next.delete(instanceId)
      else next.add(instanceId)
      return next
    })
  }

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
          same number from the top. One chance only.
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
    </div>
  )
}
