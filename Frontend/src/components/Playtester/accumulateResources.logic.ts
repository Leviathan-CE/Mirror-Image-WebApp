/**
 * Accumulate Resources — parse invoke-cost icons into gainable pips,
 * map solid colours to Resource Token catalog cards.
 *
 * Token identity = super type Resource + invoke-cost colour pips (`cost`),
 * not card name. Name matching caused false hits (e.g. Spirit Wire for LIF).
 */

import type { CardLibraryItem } from "@/lib/api/cards"
import {
  LOCAL_SEAT,
  type PlayerSlot,
  type PlayingCardInstance,
} from "@/components/Playtester/types"

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

function costTokens(item: CardLibraryItem): string[] {
  return (item.cost ?? []).map((t) => String(t).trim().toUpperCase())
}

/** Solid colour pips on the card (GEN / MULTI stripped). */
function solidCostColors(item: CardLibraryItem): ResourceColor[] {
  const out: ResourceColor[] = []
  for (const raw of costTokens(item)) {
    if (isGeneric(raw) || raw === "MULTI") continue
    const solid = asSolid(raw)
    if (solid) {
      out.push(solid)
      continue
    }
    if (raw.includes("-")) {
      for (const part of raw.split("-")) {
        const c = asSolid(part)
        if (c) out.push(c)
      }
    }
  }
  return out
}

function isSoleGenericResource(item: CardLibraryItem): boolean {
  const tokens = costTokens(item)
  return tokens.length > 0 && tokens.every(isGeneric)
}

/**
 * Turn one invoke-cost icon into a gainable pip.
 * Bare GEN is steel (STL); numbered GEN / GENX stay non-gainable.
 */
export function classifyCostToken(raw: string): GainablePip | null {
  const token = raw.trim().toUpperCase()
  if (!token) return null
  // Unity: bare GEN = steel pip (same as icon map). Catalog Steel still uses GEN.
  if (token === "GEN") {
    return { kind: "solid", token, color: "STL" }
  }
  if (isGeneric(token)) return null
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
 * Find the Resource token whose invoke-cost colour matches `color`.
 *
 * Rules:
 * 1. Must be super type Resource
 * 2. Prefer exact single solid pip === colour (e.g. cost: ["LIF"])
 * 3. Else Resource whose solid pips include the colour
 * 4. STL only: Resource whose cost is only GEN (catalogue Steel)
 */
export function findResourceTokenByCost(
  items: CardLibraryItem[],
  color: ResourceColor
): CardLibraryItem | null {
  const resources = items.filter(cardIsResource)

  const exact = resources.find((item) => {
    const solids = solidCostColors(item)
    return solids.length === 1 && solids[0] === color
  })
  if (exact) return exact

  const loose = resources.find((item) => solidCostColors(item).includes(color))
  if (loose) return loose

  if (color === "STL") {
    return resources.find(isSoleGenericResource) ?? null
  }

  return null
}

/**
 * Build colour → Resource Token catalog card from Resource + invoke cost.
 */
export function buildResourceTokenMap(
  items: CardLibraryItem[]
): Map<ResourceColor, CardLibraryItem> {
  const map = new Map<ResourceColor, CardLibraryItem>()
  for (const color of RESOURCE_COLORS) {
    const card = findResourceTokenByCost(items, color)
    if (card) map.set(color, card)
  }
  return map
}

export function spawnResourceTokenInstance(
  template: CardLibraryItem,
  x: number,
  y: number,
  seq: number,
  owner: PlayerSlot = LOCAL_SEAT
): PlayingCardInstance {
  return {
    instanceId: `resource-${template.id}-${seq}-${Date.now()}`,
    cardId: template.id,
    owner,
    name: template.card_name,
    artPath: template.card_art_path,
    artVersion: template.card_art_version ?? null,
    cost: Array.isArray(template.cost) ? template.cost.map(String) : [],
    zone: "stockpile",
    x,
    y,
    expended: false,
    selected: false,
    isToken: true,
  }
}
