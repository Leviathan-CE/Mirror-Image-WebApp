/**
 * Card catalogue / cost knobs.
 * Edit icon maps here — not CardCostIcons.tsx.
 */

import type { GameIconName } from "@/components/common/GameIcon"

/** Single-colour cost tokens. */
export const COLOR_ICONS: Record<string, GameIconName> = {
  LIF: "life",
  MET: "metal",
  POW: "power",
  RAM: "ram",
  TIM: "time",
  STL: "steel",
}

/** Canonical hybrid pair keys (sorted order preferred). */
export const HYBRID_ICONS: Record<string, GameIconName> = {
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

/** Generic / GENN cost tokens. */
export const GENERIC_ICONS: Record<string, GameIconName> = {
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
  GEN: "steel",
}

/** Normalize hybrid token order so POW-MET and MET-POW both resolve. */
function normalizeHybridKey(token: string): string {
  if (!token.includes("-")) return token
  const parts = token.split("-").filter(Boolean)
  if (parts.length !== 2) return token
  return [...parts].sort().join("-")
}

/** Canonical hybrids plus reverse-order aliases. */
export const HYBRID_ALIASES: Record<string, GameIconName> = {
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

/** Resolve a cost JSON token to a GameIcon name, or null if unknown. */
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
