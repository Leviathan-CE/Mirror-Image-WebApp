/**
 * Pick up to 3 gainable invoke-cost pips (and resolve hybrid / MULTI colours).
 */

import { useMemo, useState } from "react"

import { GameIcon } from "@/components/common/GameIcon"
import { costTokenToIcon } from "@/components/cards/CardCostIcons"
import { cn } from "@/lib/utils"

import {
  RESOURCE_COLORS,
  type GainablePip,
  type ResourceColor,
} from "./accumulateResources.logic"

export type AccumulatePipChooserProps = {
  cardName: string
  pips: GainablePip[]
  /** Colours that have a catalog Resource Token card. */
  availableColors: Set<ResourceColor>
  maxSelect?: number
  onConfirm: (colors: ResourceColor[]) => void
  onCancel: () => void
}

type SlotChoice = {
  pipIndex: number
  color: ResourceColor
}

export function AccumulatePipChooser({
  cardName,
  pips,
  availableColors,
  maxSelect = 3,
  onConfirm,
  onCancel,
}: AccumulatePipChooserProps) {
  const [choices, setChoices] = useState<SlotChoice[]>([])
  const limit = Math.min(maxSelect, pips.length)

  const selectedIndexes = useMemo(
    () => new Set(choices.map((c) => c.pipIndex)),
    [choices]
  )

  function defaultColorFor(pip: GainablePip): ResourceColor | null {
    if (pip.kind === "solid") {
      return availableColors.has(pip.color) ? pip.color : null
    }
    if (pip.kind === "hybrid") {
      return pip.colors.find((c) => availableColors.has(c)) ?? null
    }
    return RESOURCE_COLORS.find((c) => availableColors.has(c)) ?? null
  }

  function togglePip(index: number) {
    const pip = pips[index]
    if (!pip) return
    if (selectedIndexes.has(index)) {
      setChoices((prev) => prev.filter((c) => c.pipIndex !== index))
      return
    }
    if (choices.length >= limit) return
    const color = defaultColorFor(pip)
    if (!color) return
    setChoices((prev) => [...prev, { pipIndex: index, color }])
  }

  function setColor(index: number, color: ResourceColor) {
    if (!availableColors.has(color)) return
    setChoices((prev) => {
      const existing = prev.find((c) => c.pipIndex === index)
      if (!existing) {
        if (prev.length >= limit) return prev
        return [...prev, { pipIndex: index, color }]
      }
      return prev.map((c) =>
        c.pipIndex === index ? { ...c, color } : c
      )
    })
  }

  const needAll = pips.length <= limit
  const confirmOk = needAll
    ? choices.length === pips.length
    : choices.length === limit

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-label="Accumulate resources"
    >
      <div className="w-full max-w-md border border-cyan-500/35 bg-black/95 p-4 shadow-xl">
        <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
          Accumulate Resources
        </h2>
        <p className="mt-1 font-mono text-[11px] text-cyan-100/60">
          {cardName} — choose {needAll ? `all ${pips.length}` : `exactly ${limit}`}{" "}
          coloured pip{limit === 1 ? "" : "s"}.
        </p>

        <ul className="mt-4 space-y-2">
          {pips.map((pip, index) => {
            const selected = selectedIndexes.has(index)
            const choice = choices.find((c) => c.pipIndex === index)
            const icon = costTokenToIcon(pip.token)
            const colorOptions =
              pip.kind === "solid"
                ? [pip.color]
                : pip.kind === "hybrid"
                  ? pip.colors
                  : [...RESOURCE_COLORS]

            return (
              <li
                key={`${pip.token}-${index}`}
                className={cn(
                  "flex flex-wrap items-center gap-2 border px-2 py-2",
                  selected
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-cyan-500/20 bg-black/40"
                )}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 font-mono text-xs text-cyan-100"
                  onClick={() => togglePip(index)}
                >
                  {icon ? (
                    <GameIcon name={icon} className="h-5 w-auto" />
                  ) : (
                    <span>{pip.token}</span>
                  )}
                  <span>{selected ? "Selected" : "Select"}</span>
                </button>

                {selected && colorOptions.length > 1 ? (
                  <div className="flex flex-wrap gap-1">
                    {colorOptions.map((color) => {
                      const disabled = !availableColors.has(color)
                      const cIcon = costTokenToIcon(color)
                      return (
                        <button
                          key={color}
                          type="button"
                          disabled={disabled}
                          title={disabled ? "No token card in catalog" : color}
                          className={cn(
                            "border px-1.5 py-0.5",
                            choice?.color === color
                              ? "border-cyan-300 bg-cyan-500/25"
                              : "border-cyan-500/25",
                            disabled && "opacity-30"
                          )}
                          onClick={() => setColor(index, color)}
                        >
                          {cIcon ? (
                            <GameIcon name={cIcon} className="h-4 w-auto" />
                          ) : (
                            <span className="font-mono text-[10px]">{color}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="font-buahs93 px-3 py-1.5 text-xs text-cyan-100/70 hover:bg-cyan-500/10"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmOk}
            className="font-buahs93 border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-100 disabled:opacity-40"
            onClick={() => {
              if (!confirmOk) return
              const ordered = [...choices]
                .sort((a, b) => a.pipIndex - b.pipIndex)
                .map((c) => c.color)
              onConfirm(ordered)
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
