/**
 * Which section a newly added card belongs in.
 *
 * A section matches when the card has every type the section claims.
 * The longest match wins. Two matches of the same length are a tie,
 * and the card is not filed until the sets are made distinct.
 */

import {
  mainCategoryId,
  isObjectiveCategory,
  isPilotCategory,
} from "@/components/decks/deck.logic"
import type { DeckCategoryOut } from "@/lib/api/decks"

export type CardTypeSource = {
  super_types?: readonly string[] | null
  sub_types?: readonly string[] | null
  types_line?: string | null
}

export type SectionChoice =
  | { kind: "section"; categoryId: number }
  | { kind: "fallback"; categoryId: number | null }
  | { kind: "ambiguous" }

export function typeToken(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

export function typeKey(value: string): string {
  return typeToken(value).toLowerCase()
}

export function cardTypeKeys(card: CardTypeSource): Set<string> {
  const keys = new Set<string>()
  const groups = [
    card.super_types ?? [],
    card.sub_types ?? [],
  ]
  for (const group of groups) {
    for (const value of group) {
      const key = typeKey(String(value))
      if (key === "") continue
      keys.add(key)
    }
  }
  const line = typeKey(card.types_line ?? "")
  if (line !== "") keys.add(line)
  return keys
}

function claimedKeys(types: readonly string[] | null | undefined): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const value of types ?? []) {
    const key = typeKey(value)
    if (key === "" || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

export function sectionTypeProblem(
  categories: DeckCategoryOut[],
  categoryId: number,
  types: readonly string[]
): "repeated" | "taken" | null {
  const seen = new Set<string>()
  for (const value of types) {
    const key = typeKey(value)
    if (key === "") continue
    if (seen.has(key)) return "repeated"
    seen.add(key)
  }
  if (seen.size === 0) return null

  const wanted = [...seen].sort().join("|")
  for (const category of categories) {
    if (category.id === categoryId) continue
    const other = claimedKeys(category.accept_types)
    if (other.length === 0) continue
    if ([...other].sort().join("|") === wanted) return "taken"
  }
  return null
}

export function sectionForAddedCard(
  categories: DeckCategoryOut[],
  card: CardTypeSource
): SectionChoice {
  const cardKeys = cardTypeKeys(card)
  const pool = categories.filter((category) => {
    if (isPilotCategory(category)) return false
    if (isObjectiveCategory(category)) return false
    return true
  })

  const matches = pool.filter((category) => {
    const wanted = claimedKeys(category.accept_types)
    if (wanted.length === 0) return false
    return wanted.every((key) => cardKeys.has(key))
  })

  if (matches.length === 0) {
    return {
      kind: "fallback",
      categoryId: mainCategoryId(categories),
    }
  }

  let bestSize = 0
  for (const category of matches) {
    const size = claimedKeys(category.accept_types).length
    if (size > bestSize) bestSize = size
  }

  const best = matches.filter(
    (category) => claimedKeys(category.accept_types).length === bestSize
  )
  if (best.length > 1) return { kind: "ambiguous" }
  return { kind: "section", categoryId: best[0].id }
}
