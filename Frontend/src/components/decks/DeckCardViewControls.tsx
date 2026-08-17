/**
 * Dropdown to switch the deck board between art stacks and condensed rows.
 */

export type DeckCardViewMode = "cards" | "list"

const OPTIONS: { id: DeckCardViewMode; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "list", label: "List" },
]

type DeckCardViewControlsProps = {
  value: DeckCardViewMode
  onChange: (mode: DeckCardViewMode) => void
}

export function DeckCardViewControls({
  value,
  onChange,
}: DeckCardViewControlsProps) {
  return (
    <label className="cliped-angle inline-flex items-center gap-2">
      <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
        VIEW
      </span>
      <select
        value={value}
        aria-label="Deck view"
        className="font-buahs93 h-8 rounded-none border border-cyan-500/30 bg-black/80 px-2 text-xs tracking-wide text-cyan-100 outline-none hover:border-cyan-400/50 focus-visible:border-cyan-400"
        onChange={(event) =>
          onChange(event.target.value as DeckCardViewMode)
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
