/**
 * Opening layout for equipped augments on the shared battlefield.
 *
 * Coordinates live on the instance so they can be dragged like any other
 * battlefield card, but the *home* edge is viewer-relative: each client draws
 * itself at the bottom, so "next to my stockpile" is a high y for the local
 * seat and a low y for the opponent. Stored x/y win once the player moves one.
 */

import type { PlayerSlot } from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/types"

/** Matches PlayingCard default footprint (w-28 h-36). */
export const AUGMENT_CARD_H = 144
export const AUGMENT_STEP_X = 132
export const AUGMENT_PAD = 16

export function augmentHomeY(nearLocalStockpile: boolean, surfaceHeight: number): number {
  if (!nearLocalStockpile) return AUGMENT_PAD
  return Math.max(AUGMENT_PAD, surfaceHeight - AUGMENT_CARD_H - AUGMENT_PAD)
}

/**
 * Fill in missing x/y so each owner's augments sit in a row on the battlefield
 * edge that touches that player's stockpile on *this* screen.
 */
export function placeAugmentsForView(
  cards: PlayingCardInstance[],
  localSeat: PlayerSlot,
  surfaceHeight: number
): PlayingCardInstance[] {
  let localIndex = 0
  let oppIndex = 0

  return cards.map((card) => {
    if (!card.isAugment) return card
    if (card.x != null && card.y != null) return card

    const mine = card.owner === localSeat
    const index = mine ? localIndex++ : oppIndex++
    return {
      ...card,
      x: card.x ?? AUGMENT_PAD + index * AUGMENT_STEP_X,
      y: card.y ?? augmentHomeY(mine, surfaceHeight),
    }
  })
}
