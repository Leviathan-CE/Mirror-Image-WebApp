/**
 * Dropdown to choose how cards are ordered inside deck sections.
 */

export type DeckCardSortMode = "type" | "invoke" | "name"

const OPTIONS: { id: DeckCardSortMode; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "invoke", label: "Invoke cost ↑" },
  { id: "name", label: "A–Z" },
]

type DeckCardSortControlsProps = {
  value: DeckCardSortMode
  onChange: (mode: DeckCardSortMode) => void
}

export function DeckCardSortControls({
  value,
  onChange,
}: DeckCardSortControlsProps) {
  return (
    <label className="cliped-angle inline-flex items-center gap-2">
      <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
        SORT
      </span>
      <select
        value={value}
        aria-label="Sort cards"
        className="font-buahs93 h-8 rounded-none border border-cyan-500/30 bg-black/80 px-2 text-xs tracking-wide text-cyan-100 outline-none hover:border-cyan-400/50 focus-visible:border-cyan-400"
        onChange={(event) =>
          onChange(event.target.value as DeckCardSortMode)
        }
      >
        {OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
