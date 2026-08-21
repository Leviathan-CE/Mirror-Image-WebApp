/**
 * Colour identity for condensed deck-list rows.
 * Identity comes from invoke-cost pips (not a separate colours column).
 */

import type { CSSProperties } from "react"

export const DECK_RESOURCE_COLORS = [
  "LIF",
  "MET",
  "POW",
  "RAM",
  "TIM",
  "STL",
] as const

export type DeckResourceColor = (typeof DECK_RESOURCE_COLORS)[number]

/** Plate colours sampled from the cost icons (dark enough for white text + wash). */
export const DECK_COLOR_HEX: Record<DeckResourceColor, string> = {
  LIF: "#7f1d1d",
  MET: "#5b21b6",
  POW: "#a16207",
  RAM: "#1d4ed8",
  TIM: "#166534",
  STL: "#475569",
}

const COLORLESS_HEX = "#334155"
const WASH = "linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.42))"
const SOLID = new Set<string>(DECK_RESOURCE_COLORS)

function isGeneric(token: string): boolean {
  return token === "GEN" || /^GEN\d+$/.test(token) || token === "GENX"
}

function asSolid(part: string): DeckResourceColor | null {
  return SOLID.has(part) ? (part as DeckResourceColor) : null
}

function addUnique(
  out: DeckResourceColor[],
  seen: Set<DeckResourceColor>,
  color: DeckResourceColor
): void {
  if (seen.has(color)) return
  seen.add(color)
  out.push(color)
}

/** Unique resource colours on a cost line, left-to-right, hybrids split. */
export function cardColorIdentity(
  cost: string[] | undefined | null
): DeckResourceColor[] {
  const seen = new Set<DeckResourceColor>()
  const out: DeckResourceColor[] = []

  for (const raw of cost ?? []) {
    const key = String(raw).trim().toUpperCase()
    if (!key || isGeneric(key)) continue
    if (key === "MULTI") {
      for (const color of DECK_RESOURCE_COLORS) {
        addUnique(out, seen, color)
      }
      continue
    }
    const solid = asSolid(key)
    if (solid) {
      addUnique(out, seen, solid)
      continue
    }
    if (!key.includes("-")) continue
    for (const part of key.split("-")) {
      const hybrid = asSolid(part.trim())
      if (hybrid) addUnique(out, seen, hybrid)
    }
  }

  return out
}

export function deckCardRowBackground(
  cost: string[] | undefined | null
): string {
  const hexes = cardColorIdentity(cost).map((color) => DECK_COLOR_HEX[color])
  if (hexes.length === 0) return COLORLESS_HEX
  if (hexes.length === 1) return hexes[0]!
  return `linear-gradient(90deg, ${hexes.join(", ")})`
}

export function deckCardRowStyle(
  cost: string[] | undefined | null
): CSSProperties {
  const fill = deckCardRowBackground(cost)
  if (fill.startsWith("linear-gradient")) {
    return { backgroundImage: `${WASH}, ${fill}` }
  }
  return { backgroundColor: fill, backgroundImage: WASH }
}
