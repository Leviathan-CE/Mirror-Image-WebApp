/**
 * Switch the deck aside between the card library and stats.
 */

type DeckPanelToggleProps = {
  statsOn: boolean
  onChange: (statsOn: boolean) => void
}

export function DeckPanelToggle({
  statsOn,
  onChange,
}: DeckPanelToggleProps) {
  const thumb = statsOn ? "left-9" : "left-1"
  return (
    <div className="cliped-angle inline-flex items-center gap-2">
      <button
        type="button"
        className={sideClass(!statsOn)}
        onClick={() => onChange(false)}
      >
        LIBRARY
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={statsOn}
        aria-label="Library or stats"
        className={
          "relative h-8 w-16 border border-cyan-500/30 " +
          "bg-black/80 focus-visible:border-cyan-400"
        }
        onClick={() => onChange(!statsOn)}
      >
        <span
          className={
            "pointer-events-none absolute top-1 h-6 w-6 " +
            "bg-cyan-300 transition-[left] " +
            thumb
          }
        />
      </button>
      <button
        type="button"
        className={sideClass(statsOn)}
        onClick={() => onChange(true)}
      >
        STATS
      </button>
    </div>
  )
}

function sideClass(active: boolean): string {
  const tone = active ? "text-cyan-100" : "text-cyan-500/70"
  return "font-mono text-[10px] tracking-wide " + tone
}
