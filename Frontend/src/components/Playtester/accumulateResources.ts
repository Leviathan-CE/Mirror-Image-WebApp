/**
 * Accumulate Resources — parse invoke-cost icons into gainable pips,
 * map solid colours to Resource Token catalog cards.
 */

import type { CardLibraryItem } from "@/lib/api/cards"
import type { PlayingCardInstance } from "@/components/Playtester/types"

export const RESOURCE_COLORS = [
  "LIF",
  "MET",
  "POW",
  "RAM",
  "TIM",
  "STL",
] as const

export type ResourceColor = (typeof RESOURCE_COLORS)[number]

export type GainablePip =
  | { kind: "solid"; token: string; color: ResourceColor }
  | { kind: "hybrid"; token: string; colors: [ResourceColor, ResourceColor] }
  | { kind: "multi"; token: string }

const SOLID = new Set<string>(RESOURCE_COLORS)

function isGeneric(token: string): boolean {
  const key = token.trim().toUpperCase()
  return key === "GEN" || /^GEN\d+$/.test(key) || key === "GENX"
}

function asSolid(part: string): ResourceColor | null {
  const key = part.trim().toUpperCase()
  return SOLID.has(key) ? (key as ResourceColor) : null
}

function cardIsResource(item: CardLibraryItem): boolean {
  const supers = (item.super_types ?? []).map((t) =>
    String(t).trim().toLowerCase()
  )
  const typesLine = String(item.types_line ?? "").toLowerCase()
  return supers.includes("resource") || typesLine.includes("resource")
}

function cardIsToken(item: CardLibraryItem): boolean {
  const supers = (item.super_types ?? []).map((t) =>
    String(t).trim().toLowerCase()
  )
  const typesLine = String(item.types_line ?? "").toLowerCase()
  return supers.includes("token") || typesLine.includes("token")
}

/** Turn one invoke-cost icon into a gainable pip (or null if GEN / unknown). */
export function classifyCostToken(raw: string): GainablePip | null {
  const token = raw.trim().toUpperCase()
  if (!token || isGeneric(token)) return null
  if (token === "MULTI") return { kind: "multi", token }
  if (SOLID.has(token)) {
    return { kind: "solid", token, color: token as ResourceColor }
  }
  if (token.includes("-")) {
    const parts = token
      .split("-")
      .map((p) => asSolid(p))
      .filter(Boolean) as ResourceColor[]
    const unique = [...new Set(parts)]
    if (unique.length === 2) {
      return { kind: "hybrid", token, colors: [unique[0]!, unique[1]!] }
    }
    if (unique.length === 1) {
      return { kind: "solid", token, color: unique[0]! }
    }
  }
  return null
}

export function extractGainablePips(
  cost: string[] | undefined | null
): GainablePip[] {
  if (!cost?.length) return []
  const out: GainablePip[] = []
  for (const raw of cost) {
    const pip = classifyCostToken(String(raw))
    if (pip) out.push(pip)
  }
  return out
}

/** True when every pip is solid and count ≤ 3 — no chooser needed. */
export function canAutoResolvePips(pips: GainablePip[]): boolean {
  return (
    pips.length > 0 &&
    pips.length <= 3 &&
    pips.every((p) => p.kind === "solid")
  )
}

export function autoResolveColors(pips: GainablePip[]): ResourceColor[] {
  return pips
    .filter(
      (p): p is Extract<GainablePip, { kind: "solid" }> => p.kind === "solid"
    )
    .map((p) => p.color)
    .slice(0, 3)
}

/**
 * Known Resource Token card names in the catalogue (preload by name).
 * Blue pip = RAM → "R.A.M", etc.
 */
export const RESOURCE_TOKEN_NAME_MAP: {
  color: ResourceColor
  names: string[]
}[] = [
  { color: "POW", names: ["Unit of Power"] },
  { color: "LIF", names: ["Spirit", "Life", "Unit of Life"] },
  { color: "TIM", names: ["Natural Time"] },
  { color: "MET", names: ["Living Metal"] },
  { color: "STL", names: ["Steel"] },
  { color: "RAM", names: ["R.A.M", "R.A.M.", "RAM"] },
]

export function allResourceTokenSearchNames(): string[] {
  const out: string[] = []
  for (const entry of RESOURCE_TOKEN_NAME_MAP) {
    for (const name of entry.names) {
      if (!out.includes(name)) out.push(name)
    }
  }
  return out
}

function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Prefer exact name match for a colour’s known token titles. */
export function findNamedResourceToken(
  items: CardLibraryItem[],
  color: ResourceColor
): CardLibraryItem | null {
  const entry = RESOURCE_TOKEN_NAME_MAP.find((e) => e.color === color)
  if (!entry) return null
  const wanted = entry.names.map(normalizeCardName)

  const exact = items.find((item) =>
    wanted.includes(normalizeCardName(item.card_name))
  )
  if (exact) return exact

  return (
    items.find((item) => {
      const n = normalizeCardName(item.card_name)
      return wanted.some((w) => n === w || n.includes(w) || w.includes(n))
    }) ?? null
  )
}

/**
 * Build colour → Resource Token catalog card.
 * 1) Match known token names (Unit of Power, R.A.M, …)
 * 2) Fall back to cost-colour / Resource|Token typing
 */
export function buildResourceTokenMap(
  items: CardLibraryItem[]
): Map<ResourceColor, CardLibraryItem> {
  const map = new Map<ResourceColor, CardLibraryItem>()

  for (const color of RESOURCE_COLORS) {
    const named = findNamedResourceToken(items, color)
    if (named) map.set(color, named)
  }

  const exact: Partial<Record<ResourceColor, CardLibraryItem>> = {}
  const loose: Partial<Record<ResourceColor, CardLibraryItem>> = {}

  for (const item of items) {
    if (!cardIsResource(item) && !cardIsToken(item)) continue

    const tokens = (item.cost ?? []).map((t) => String(t).trim().toUpperCase())
    for (const color of RESOURCE_COLORS) {
      if (map.has(color)) continue
      const exactMatch = tokens.length === 1 && tokens[0] === color
      const looseMatch =
        tokens.includes(color) ||
        tokens.some(
          (t) => t.startsWith(`${color}-`) || t.endsWith(`-${color}`)
        )
      if (!exactMatch && !looseMatch) continue

      if (exactMatch) {
        const prev = exact[color]
        if (!prev || (cardIsResource(item) && !cardIsResource(prev))) {
          exact[color] = item
        }
      } else {
        const prev = loose[color]
        if (!prev || (cardIsResource(item) && !cardIsResource(prev))) {
          loose[color] = item
        }
      }
    }
  }

  for (const color of RESOURCE_COLORS) {
    if (map.has(color)) continue
    const card = exact[color] ?? loose[color]
    if (card) map.set(color, card)
  }
  return map
}

export function spawnResourceTokenInstance(
  template: CardLibraryItem,
  x: number,
  y: number,
  seq: number
): PlayingCardInstance {
  return {
    instanceId: `resource-${template.id}-${seq}-${Date.now()}`,
    cardId: template.id,
    name: template.card_name,
    artPath: template.card_art_path,
    artVersion: template.card_art_version ?? null,
    cost: Array.isArray(template.cost) ? template.cost.map(String) : [],
    zone: "stockpile",
    x,
    y,
    expended: false,
    selected: false,
    isResourceToken: true,
  }
}
