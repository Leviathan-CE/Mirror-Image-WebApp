/**
 * Map card cost JSON tokens (LIF, GEN1, LIF-POW, …) to GameIcon names.
 */

import {
  GameIcon,
  type GameIconName,
} from "@/components/common/GameIcon"

const COLOR_ICONS: Record<string, GameIconName> = {
  LIF: "life",
  MET: "metal",
  POW: "power",
  RAM: "ram",
  TIM: "time",
  STL: "steel",
}

const HYBRID_ICONS: Record<string, GameIconName> = {
  "LIF-MET": "lifMet",
  "LIF-POW": "lifPow",
  "LIF-RAM": "lifRam",
  "LIF-STL": "lifStl",
  "LIF-TIM": "lifTim",
  "MET-STL": "metStl",
  "MET-TIM": "metTim",
  "POW-MET": "powMet",
  "POW-RAM": "powRam",
  "POW-STL": "powStl",
  "POW-TIM": "powTim",
  "RAM-MET": "ramMet",
  "RAM-STL": "ramStl",
  "RAM-TIM": "ramTim",
  "STL-TIM": "stlTim",
  MULTI: "multi",
}

const GENERIC_ICONS: Record<string, GameIconName> = {
  GEN0: "gen0",
  GEN1: "gen1",
  GEN2: "gen2",
  GEN3: "gen3",
  GEN4: "gen4",
  GEN5: "gen5",
  GEN6: "gen6",
  GEN7: "gen7",
  GEN8: "gen8",
  GEN9: "gen9",
  GEN10: "gen10",
  GENX: "genX",
  GEN: "genX",
}

/** Normalize hybrid token order so POW-MET and MET-POW both resolve. */
function normalizeHybridKey(token: string): string {
  if (!token.includes("-")) return token
  const parts = token.split("-").filter(Boolean)
  if (parts.length !== 2) return token
  return [...parts].sort().join("-")
}

const HYBRID_ALIASES: Record<string, GameIconName> = {
  ...HYBRID_ICONS,
  "MET-LIF": "lifMet",
  "POW-LIF": "lifPow",
  "RAM-LIF": "lifRam",
  "STL-LIF": "lifStl",
  "TIM-LIF": "lifTim",
  "STL-MET": "metStl",
  "TIM-MET": "metTim",
  "MET-POW": "powMet",
  "RAM-POW": "powRam",
  "STL-POW": "powStl",
  "TIM-POW": "powTim",
  "MET-RAM": "ramMet",
  "STL-RAM": "ramStl",
  "TIM-RAM": "ramTim",
  "TIM-STL": "stlTim",
}

export function costTokenToIcon(token: string): GameIconName | null {
  const key = token.trim().toUpperCase()
  if (!key) return null
  if (COLOR_ICONS[key]) return COLOR_ICONS[key]
  if (GENERIC_ICONS[key]) return GENERIC_ICONS[key]
  if (HYBRID_ALIASES[key]) return HYBRID_ALIASES[key]
  const hybrid = normalizeHybridKey(key)
  if (HYBRID_ALIASES[hybrid]) return HYBRID_ALIASES[hybrid]
  // Unknown high GENN etc. — closest available glyph.
  if (/^GEN\d+$/.test(key)) return "genX"
  return null
}

type CardCostIconsProps = {
  cost: string[]
  className?: string
  iconClassName?: string
}

export function CardCostIcons({
  cost,
  className,
  iconClassName,
}: CardCostIconsProps) {
  if (!cost.length) {
    return (
      <span className={className ?? "font-mono text-[10px] text-white/35"}>
        —
      </span>
    )
  }

  return (
    <span className={className ?? "inline-flex flex-wrap items-center gap-0.5"}>
      {cost.map((token, index) => {
        const icon = costTokenToIcon(token)
        if (!icon) {
          return (
            <span
              key={`${token}-${index}`}
              className="font-mono text-[10px] text-cyan-300/70"
            >
              {token}
            </span>
          )
        }
        return (
          <GameIcon
            key={`${token}-${index}`}
            name={icon}
            className={iconClassName ?? "h-4 w-auto lg:h-4 2xl:h-4"}
          />
        )
      })}
    </span>
  )
}
