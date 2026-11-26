/**
 * Catalogue card finishes (`cards.card_printing`).
 * Codes match the game CardPrinting enum values.
 */

export type CardPrintingId =
  | "standard"
  | "full_art"
  | "alt_art"
  | "alt_art_bordered"
  | "alt_art_stamped"

export type CardPrintingOption = {
  id: CardPrintingId
  label: string
  code: number
}

export const CARD_PRINTING_OPTIONS: CardPrintingOption[] = [
  { id: "standard", label: "Standard", code: 1 },
  { id: "full_art", label: "Full Art", code: 4 },
  { id: "alt_art", label: "Alt Art", code: 7 },
  { id: "alt_art_bordered", label: "Alt Art Bordered", code: 8 },
  { id: "alt_art_stamped", label: "Alt Art Stamped", code: 10 },
]
