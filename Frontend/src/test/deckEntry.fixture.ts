/**
 * Shared DeckCardEntry factory for tests (nested `card` shape).
 * Accepts flat convenience fields (`card_id`, `card_name`, …) for migration.
 */

import type { CardSummary } from "@/lib/api/cards"
import type { DeckCardEntry } from "@/lib/api/decks"

export type DeckEntryFixtureOverrides = Partial<
  Omit<DeckCardEntry, "card">
> & {
  card?: Partial<CardSummary>
  card_id?: number
  card_name?: string
  card_art_path?: string | null
  card_art_version?: number | null
  invoke_cost?: number
  cost?: string[]
  threat_level?: string
  types_line?: string
  super_types?: string[]
  sub_types?: string[]
  is_pilot?: boolean
  is_augment?: boolean
  is_summon?: boolean
  hand_size?: number
  ram_capacity?: number
  power_capacity?: number
  metal_capacity?: number
  spirit_capacity?: number
  steel_capacity?: number
  time_capacity?: number
  lif_capacity?: number
}

export function deckEntry(
  overrides: DeckEntryFixtureOverrides = {}
): DeckCardEntry {
  const {
    card: cardPartial,
    card_id,
    card_name,
    card_art_path,
    card_art_version,
    invoke_cost,
    cost,
    threat_level,
    types_line,
    super_types,
    sub_types,
    is_pilot,
    is_augment,
    is_summon,
    hand_size,
    ram_capacity,
    power_capacity,
    metal_capacity,
    spirit_capacity,
    steel_capacity,
    time_capacity,
    lif_capacity,
    quantity,
    category_id,
    category_name,
    sort_order,
    is_classified,
    classification,
  } = overrides

  const id = cardPartial?.id ?? card_id ?? 1

  const card: CardSummary = {
    id,
    card_name: cardPartial?.card_name ?? card_name ?? `Card ${id}`,
    card_art_path: cardPartial?.card_art_path ?? card_art_path ?? null,
    card_art_version: cardPartial?.card_art_version ?? card_art_version,
    invoke_cost: cardPartial?.invoke_cost ?? invoke_cost,
    cost: cardPartial?.cost ?? cost,
    threat_level: cardPartial?.threat_level ?? threat_level,
    types_line: cardPartial?.types_line ?? types_line,
    super_types: cardPartial?.super_types ?? super_types,
    sub_types: cardPartial?.sub_types ?? sub_types,
    is_pilot: cardPartial?.is_pilot ?? is_pilot,
    is_augment: cardPartial?.is_augment ?? is_augment,
    is_summon: cardPartial?.is_summon ?? is_summon,
    hand_size: cardPartial?.hand_size ?? hand_size,
    ram_capacity: cardPartial?.ram_capacity ?? ram_capacity,
    power_capacity: cardPartial?.power_capacity ?? power_capacity,
    metal_capacity: cardPartial?.metal_capacity ?? metal_capacity,
    spirit_capacity: cardPartial?.spirit_capacity ?? spirit_capacity,
    steel_capacity: cardPartial?.steel_capacity ?? steel_capacity,
    time_capacity: cardPartial?.time_capacity ?? time_capacity,
    lif_capacity: cardPartial?.lif_capacity ?? lif_capacity,
  }

  if (cardPartial) {
    Object.assign(card, cardPartial, { id })
  }

  return {
    quantity: quantity ?? 1,
    category_id: category_id ?? 1,
    category_name: category_name ?? "Main",
    sort_order: sort_order ?? 0,
    card,
    is_classified,
    classification,
  }
}
