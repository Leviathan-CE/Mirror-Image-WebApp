/**
 * Collect deck rows for a print-and-play PDF
 * (pilot + objectives + in-deck RIG sections).
 */

import { objectiveCards, pilotCard } from "@/components/decks/deck.logic"
import { libraryDeckEntries } from "@/components/Playtester/session/setupOpeningSession.logic"
import type { DeckCardEntry, DeckDetail } from "@/lib/api/decks"

export type DeckPrintoutSlot = {
  card_id: number
  card_name: string
  card_art_path: string | null
  card_thumbnail_path?: string | null
  card_art_version?: number | null
  section: "pilot" | "objective" | "deck"
}

/**
 * Map a front-page grid index to the back-page index for duplex print.
 *
 * Portrait + flip on long edge mirrors left/right. Without this, the back
 * behind the top-left face would be the top-right back when you hold the
 * sheet up to the light / after cutting.
 */
export function duplexBackIndex(
  frontIndex: number,
  cols = 3
): number {
  const col = frontIndex % cols
  const row = Math.floor(frontIndex / cols)
  return row * cols + (cols - 1 - col)
}

/** Letter page + 3×3 grid used by the printout PDF and staff preview. */
export const PRINTOUT_PAGE_W_MM = 215.9
export const PRINTOUT_PAGE_H_MM = 279.4
export const PRINTOUT_COLS = 3
export const PRINTOUT_ROWS = 3
export const PRINTOUT_PER_PAGE = PRINTOUT_COLS * PRINTOUT_ROWS
export const PRINTOUT_GAP_MM = 0.5
/** Card height ÷ width (3:4 portrait). */
export const PRINTOUT_CARD_ASPECT = 4 / 3
export const PRINTOUT_MARGIN_MIN_MM = 4
export const PRINTOUT_MARGIN_MAX_MM = 14
export const PRINTOUT_MARGIN_DEFAULT_MM = 10

export type PrintoutGridLayout = {
  cardW: number
  cardH: number
  originX: number
  originY: number
  marginMm: number
}

export function clampPrintoutMarginMm(marginMm: number): number {
  if (!Number.isFinite(marginMm)) return PRINTOUT_MARGIN_DEFAULT_MM
  return Math.min(
    PRINTOUT_MARGIN_MAX_MM,
    Math.max(PRINTOUT_MARGIN_MIN_MM, marginMm)
  )
}

/** Larger margin shrinks each card so the 3×3 grid still fits on letter. */
export function computePrintoutGridLayout(
  marginMm = PRINTOUT_MARGIN_DEFAULT_MM
): PrintoutGridLayout {
  const inset = clampPrintoutMarginMm(marginMm)
  const usableW = PRINTOUT_PAGE_W_MM - inset * 2
  const usableH = PRINTOUT_PAGE_H_MM - inset * 2
  const maxWFromWidth =
    (usableW - PRINTOUT_GAP_MM * (PRINTOUT_COLS - 1)) / PRINTOUT_COLS
  const maxHFromHeight =
    (usableH - PRINTOUT_GAP_MM * (PRINTOUT_ROWS - 1)) / PRINTOUT_ROWS

  let cardW = maxWFromWidth
  let cardH = cardW * PRINTOUT_CARD_ASPECT
  if (cardH > maxHFromHeight) {
    cardH = maxHFromHeight
    cardW = cardH / PRINTOUT_CARD_ASPECT
  }

  const gridW = cardW * PRINTOUT_COLS + PRINTOUT_GAP_MM * (PRINTOUT_COLS - 1)
  const gridH = cardH * PRINTOUT_ROWS + PRINTOUT_GAP_MM * (PRINTOUT_ROWS - 1)
  return {
    cardW,
    cardH,
    originX: (PRINTOUT_PAGE_W_MM - gridW) / 2,
    originY: (PRINTOUT_PAGE_H_MM - gridH) / 2,
    marginMm: inset,
  }
}

export function printoutPageCount(slotCount: number): number {
  if (slotCount <= 0) return 0
  return Math.ceil(slotCount / PRINTOUT_PER_PAGE)
}

export function sanitizePrintoutFileName(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 80)
  const trimmed = cleaned.replace(/^_+|_+$/g, "")
  if (!trimmed) return "deck_printout"
  return trimmed
}

export function defaultPrintoutFileName(deckName: string): string {
  const base = sanitizePrintoutFileName(deckName || "deck")
  if (base.toLowerCase().endsWith(".pdf")) return base
  if (base.endsWith("_printout")) return `${base}.pdf`
  return `${base}_printout.pdf`
}

export function resolvePrintoutFileName(
  fileName: string | undefined,
  deckName: string
): string {
  const raw = (fileName ?? "").trim()
  return defaultPrintoutFileName(raw || deckName || "deck")
}

function expandQuantity(
  entries: DeckCardEntry[],
  section: "objective" | "deck"
): DeckPrintoutSlot[] {
  const out: DeckPrintoutSlot[] = []
  for (const entry of entries) {
    const copies = Math.max(0, Math.floor(entry.quantity))
    for (let i = 0; i < copies; i++) {
      out.push({
        card_id: entry.card.id,
        card_name: entry.card.card_name,
        card_art_path: entry.card.card_art_path,
        card_thumbnail_path: entry.card.card_thumbnail_path,
        card_art_version: entry.card.card_art_version,
        section,
      })
    }
  }
  return out
}

/** Ordered print list: pilot, objectives, then in-deck RIG rows. */
export function collectDeckPrintoutSlots(deck: DeckDetail): DeckPrintoutSlot[] {
  const slots: DeckPrintoutSlot[] = []

  const pilot = pilotCard(deck.cards, deck.categories)
  if (pilot) {
    slots.push({
      card_id: pilot.card.id,
      card_name: pilot.card.card_name,
      card_art_path: pilot.card.card_art_path,
      card_thumbnail_path: pilot.card.card_thumbnail_path,
      card_art_version: pilot.card.card_art_version,
      section: "pilot",
    })
  }

  const objectives = objectiveCards(deck.cards, deck.categories, "name")
  for (const slot of expandQuantity(objectives, "objective")) {
    slots.push(slot)
  }

  const main = libraryDeckEntries(deck).sort((a, b) => {
    const order = a.sort_order - b.sort_order
    if (order !== 0) return order
    return a.card.card_name.localeCompare(b.card.card_name)
  })

  for (const slot of expandQuantity(main, "deck")) {
    slots.push(slot)
  }

  return slots
}
