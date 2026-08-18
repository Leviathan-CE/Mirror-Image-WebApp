/**
 * Opening homes on the shared in-play field (viewer-relative).
 *
 * Each client draws itself at the bottom of the screen:
 *   local  → high y (near the hand)
 *   opponent → low y (far edge)
 *
 * Unmoved resources sit beside the default hand (left for local, right for
 * opponent), fanned by colour away from the window.
 * Unmoved augments sit just above (local) or below (opponent) the hand,
 * packed against the deck-side field edge.
 * Stored x/y win once the player drags a card.
 */

import {
  RESOURCE_COLORS,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources.logic"
import {
  defaultHandFloatBox,
  readStoredHandFloatBox,
  type ParentSize,
} from "@/components/Playtester/handFloatPanel.logic"
import {
  PLAY_PILE_SIZE,
  PLAY_ZONE,
  type PlayerSlot,
} from "@/components/Playtester/playtesterConstants"
import type { PlayingCardInstance } from "@/components/Playtester/types"

/** Face height of an augment. Placement lift is `AUGMENT_LIFT_Y`, not this. */
export const AUGMENT_CARD_H = PLAY_PILE_SIZE.lg.h
/** Extra pixels to raise local augments above the hand (does not move resources). */
export const AUGMENT_LIFT_Y = 200
export const AUGMENT_STEP_X = PLAY_PILE_SIZE.lg.w + 20
export const AUGMENT_PAD = 16

export const RESOURCE_CARD_W = PLAY_PILE_SIZE.lg.w 
/** Face height of a resource token. Placement lift is `RESOURCE_LIFT_Y`, not this. */
export const RESOURCE_CARD_H = PLAY_PILE_SIZE.lg.h
/** Extra pixels to raise local resource fans beside the hand (does not move augments). */
export const RESOURCE_LIFT_Y = 0
export const RESOURCE_FAN_STAGGER_X = 22
export const RESOURCE_FAN_STAGGER_Y = 22
export const RESOURCE_FAN_GROUP_GAP = 36
/** Extra copies from accumulate / generate step along the hand, not into the fan. */
export const GENERATED_RESOURCE_STEP_X = PLAY_PILE_SIZE.lg.w + 16

export function resourceHomeY(
  nearLocal: boolean,
  field: ParentSize
): number {
  const hand = handHomeBox(nearLocal, field)
  if (!nearLocal) return hand.y + RESOURCE_LIFT_Y
  return Math.max(
    AUGMENT_PAD,
    hand.y + hand.height - RESOURCE_CARD_H - RESOURCE_LIFT_Y
  )
}

function handHomeBox(nearLocal: boolean, field: ParentSize) {
  return defaultHandFloatBox(field, nearLocal ? "bottom" : "top")
}

/** Left edge of the first colour pile, immediately beside the default hand. */
export function resourceAnchorX(
  nearLocal: boolean,
  field: ParentSize
): number {
  const hand = handHomeBox(nearLocal, field)
  if (nearLocal) {
    return Math.max(AUGMENT_PAD, hand.x - RESOURCE_CARD_W + 400)
  }
  return Math.min(
    Math.max(AUGMENT_PAD, field.width - RESOURCE_CARD_W),
    hand.x + hand.width + AUGMENT_PAD
  )
}

/** Just outside the default hand window so the two homes do not overlap. */
export function augmentHomeY(
  nearLocal: boolean,
  field: ParentSize
): number {
  const hand = handHomeBox(nearLocal, field)
  if (!nearLocal) return hand.y + hand.height + AUGMENT_PAD
  return Math.max(
    AUGMENT_PAD,
    hand.y - AUGMENT_CARD_H - AUGMENT_PAD - AUGMENT_LIFT_Y
  )
}

/**
 * Packed against the deck-side field edge. Local extras step left (away
 * from the right-column deck); opponent extras step right (away from the
 * left-column deck).
 */
export function augmentHomeX(
  index: number,
  field: ParentSize,
  nearLocal = true
): number {
  const width = PLAY_PILE_SIZE.lg.w
  if (nearLocal) {
    return Math.max(
      AUGMENT_PAD,
      field.width - AUGMENT_PAD - width - index * AUGMENT_STEP_X
    )
  }
  return AUGMENT_PAD + index * AUGMENT_STEP_X
}

/**
 * Mid-game generate / accumulate (not opening setup). Writes x/y so the
 * token skips the beside-hand fan. Sits just above (local) / below (opp)
 * the current hand window. `index` only staggers a single burst — do not
 * feed a running total or later copies walk off the field.
 */
export function generatedResourceHome(
  field: ParentSize,
  nearLocal: boolean,
  index: number
): { x: number; y: number } {
  const hand = readStoredHandFloatBox(
    field,
    nearLocal ? "bottom" : "top"
  )
  const y = nearLocal
    ? Math.max(AUGMENT_PAD, hand.y - RESOURCE_CARD_H - AUGMENT_PAD)
    : Math.min(
        Math.max(AUGMENT_PAD, hand.y + hand.height + AUGMENT_PAD),
        Math.max(AUGMENT_PAD, field.height - RESOURCE_CARD_H - AUGMENT_PAD)
      )
  const maxX = Math.max(AUGMENT_PAD, field.width - RESOURCE_CARD_W - AUGMENT_PAD)
  const x = Math.min(
    maxX,
    Math.max(AUGMENT_PAD, hand.x + index * GENERATED_RESOURCE_STEP_X)
  )
  return { x, y }
}

/** Stockpile tokens that already have a stored seat (generated or dragged). */
export function placedStockpileCount(
  cards: PlayingCardInstance[],
  owner: PlayerSlot
): number {
  return cards.filter(
    (card) =>
      card.zone === PLAY_ZONE.stockpile &&
      card.owner === owner &&
      card.y != null
  ).length
}

function tokenColor(card: PlayingCardInstance): ResourceColor | "other" {
  for (const color of RESOURCE_COLORS) {
    if (
      card.cost.some((pip) => pip.trim().toUpperCase() === color)
    ) {
      return color
    }
  }
  return "other"
}

function fanY(
  nearLocal: boolean,
  homeY: number,
  stackIndex: number
): number {
  const delta = stackIndex * RESOURCE_FAN_STAGGER_Y
  if (nearLocal) return Math.max(AUGMENT_PAD, homeY - delta)
  return homeY + delta
}

/**
 * Colour piles grow away from the hand; cards inside a pile fan inward
 * (up for local, down for opponent) so extras are not hidden under the first card.
 */
export function layoutResourceFans(
  tokens: PlayingCardInstance[],
  nearLocal: boolean,
  field: ParentSize
): Map<string, { x: number; y: number }> {
  const homeY = resourceHomeY(nearLocal, field)
  const awayFromHand = nearLocal ? -1 : 1
  const piles = new Map<string, PlayingCardInstance[]>()
  for (const color of RESOURCE_COLORS) piles.set(color, [])
  piles.set("other", [])

  for (const token of tokens) {
    piles.get(tokenColor(token))!.push(token)
  }

  const placed = new Map<string, { x: number; y: number }>()
  let cursorX = resourceAnchorX(nearLocal, field)
  const keys: Array<ResourceColor | "other"> = [...RESOURCE_COLORS, "other"]

  for (const key of keys) {
    const pile = piles.get(key) ?? []
    if (pile.length === 0) continue

    pile.forEach((token, index) => {
      placed.set(token.instanceId, {
        x: cursorX + index * RESOURCE_FAN_STAGGER_X * awayFromHand,
        y: fanY(nearLocal, homeY, index),
      })
    })

    cursorX +=
      awayFromHand *
      (RESOURCE_CARD_W +
        Math.max(0, pile.length - 1) * RESOURCE_FAN_STAGGER_X +
        RESOURCE_FAN_GROUP_GAP)
  }

  return placed
}

/**
 * Fill in missing x/y so each owner's augments sit in a row just outside
 * that owner's default hand window.
 */
export function placeAugmentsForView(
  cards: PlayingCardInstance[],
  localSeat: PlayerSlot,
  field: ParentSize
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
      x: card.x ?? augmentHomeX(index, field, mine),
      y: card.y ?? augmentHomeY(mine, field),
    }
  })
}

/**
 * Unmoved stockpile tokens (no stored y) join that owner's colour fans
 * beside the hand. Dragging writes x/y and leaves the fan.
 */
export function placeStockpileForView(
  cards: PlayingCardInstance[],
  localSeat: PlayerSlot,
  field: ParentSize
): PlayingCardInstance[] {
  const unmoved = (ownerIsLocal: boolean) =>
    cards.filter(
      (card) =>
        card.zone === PLAY_ZONE.stockpile &&
        card.y == null &&
        (card.owner === localSeat) === ownerIsLocal
    )

  const byId = new Map<string, { x: number; y: number }>([
    ...layoutResourceFans(unmoved(true), true, field),
    ...layoutResourceFans(unmoved(false), false, field),
  ])

  return cards.map((card) => {
    const slot = byId.get(card.instanceId)
    if (!slot) return card
    return { ...card, x: slot.x, y: slot.y }
  })
}

/** Augments + unmoved resource fans, in session order. */
export function placeInPlayForView(
  cards: PlayingCardInstance[],
  localSeat: PlayerSlot,
  field: ParentSize
): PlayingCardInstance[] {
  return placeStockpileForView(
    placeAugmentsForView(cards, localSeat, field),
    localSeat,
    field
  )
}
