/**
 * Collect deck rows for a print-and-play PDF (pilot, augments, in-deck sections).
 */

import {
  augmentCards,
  pilotCard,
} from "@/components/decks/deck.logic"
import { libraryDeckEntries } from "@/components/Playtester/session/setupOpeningSession.logic"
import type { DeckCardEntry, DeckDetail } from "@/lib/api/decks"

export type DeckPrintoutSlot = {
  card_id: number
  card_name: string
  card_art_path: string | null
  card_art_version?: number | null
  section: "pilot" | "augment" | "deck"
}

function expandQuantity(entries: DeckCardEntry[]): DeckPrintoutSlot[] {
  const out: DeckPrintoutSlot[] = []
  for (const entry of entries) {
    const copies = Math.max(0, Math.floor(entry.quantity))
    for (let i = 0; i < copies; i++) {
      out.push({
        card_id: entry.card_id,
        card_name: entry.card_name,
        card_art_path: entry.card_art_path,
        card_art_version: entry.card_art_version,
        section: "deck",
      })
    }
  }
  return out
}

/** Ordered print list: pilot, augments, then shuffled RIG sections (by category order). */
export function collectDeckPrintoutSlots(deck: DeckDetail): DeckPrintoutSlot[] {
  const slots: DeckPrintoutSlot[] = []

  const pilot = pilotCard(deck.cards, deck.categories)
  if (pilot) {
    slots.push({
      card_id: pilot.card_id,
      card_name: pilot.card_name,
      card_art_path: pilot.card_art_path,
      card_art_version: pilot.card_art_version,
      section: "pilot",
    })
  }

  for (const entry of augmentCards(deck.cards, deck.categories, "name")) {
    const copies = Math.max(0, Math.floor(entry.quantity))
    for (let i = 0; i < copies; i++) {
      slots.push({
        card_id: entry.card_id,
        card_name: entry.card_name,
        card_art_path: entry.card_art_path,
        card_art_version: entry.card_art_version,
        section: "augment",
      })
    }
  }

  const main = libraryDeckEntries(deck).sort((a, b) => {
    const order = a.sort_order - b.sort_order
    if (order !== 0) return order
    return a.card_name.localeCompare(b.card_name)
  })

  for (const slot of expandQuantity(main)) {
    slots.push({ ...slot, section: "deck" })
  }

  return slots
}
