/**
 * In-play homes for opening augments / resource fans and mid-game generate.
 *
 * Keep this dumb on purpose:
 *   start  → where index 0 sits (relative to a fixed anchor on the field)
 *   offset → added for index 1, 2, … (every card in the group uses the same step)
 *   pad    → small edge inset, and the gap between resource colour piles
 *
 * Screen space: +x right, +y down. No hand-box math, no clever clamps —
 * if a value is off-screen, fix `start` / `offset` / `pad`.
 *
 * Only cards with BOTH x and y unset get a home. Dragging writes x/y and
 * freezes that card (reload a game after tweaking knobs to see opening homes).
 */

import {
  RESOURCE_COLORS,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources.logic"
import type { ParentSize } from "@/components/Playtester/handFloatPanel.logic"
import {
  PLAY_PILE_SIZE,
  PLAY_ZONE,
  PLAYER_SLOT,
  type PlayerSlot,
} from "@/components/Playtester/constants"
import { PLAY_FLOAT_LOGICAL } from "@/components/Playtester/playFieldScale.logic"
import type { PlayingCardInstance } from "@/components/Playtester/types"

export const FACE = PLAY_PILE_SIZE.lg

/**
 * World space = p1's view (p1 sits at the bottom of the mat).
 * p2's screen is the same mat rotated 180° so they also sit at the bottom.
 * Flip is an involution: viewToWorld === worldToView.
 */
export function flipFieldPoint(
  x: number,
  y: number,
  field: ParentSize,
  faceW: number = FACE.w,
  faceH: number = FACE.h
): { x: number; y: number } {
  return {
    x: field.width - faceW - x,
    y: field.height - faceH - y,
  }
}

export function worldToView(
  x: number,
  y: number,
  localSeat: PlayerSlot,
  field: ParentSize
): { x: number; y: number } {
  if (localSeat === PLAYER_SLOT.p1) return { x, y }
  return flipFieldPoint(x, y, field)
}

export function viewToWorld(
  x: number,
  y: number,
  localSeat: PlayerSlot,
  field: ParentSize
): { x: number; y: number } {
  return worldToView(x, y, localSeat, field)
}

export type HomeLayout = {
  start: { x: number; y: number }
  offset: { x: number; y: number }
  pad: number
}

/** Local: bottom-right. Opp: top-left (mirrored).
 *  Keep `offset.y` at 0 for a flat row — any non-zero value stairs each copy. */
export const AUGMENT_LAYOUT: HomeLayout = {
  start: { x: 0, y: -220 },
  offset: { x: -(FACE.w + 20), y: 0 },
  pad: 0,
}

/**
 * Local: bottom-center (just above the docked hand). Opp: top-center.
 * Tune `start` to slide the whole fan; tune `offset` for spacing inside a pile.
 */
export const RESOURCE_FAN_LAYOUT: HomeLayout = {
  start: { x: 100, y: 10 },
  offset: { x: -22, y: -22 },
  pad: 28,
}

/** Local: bot-center. Opp: top-center. */
export const GENERATED_LAYOUT: HomeLayout = {
  start: { x: 0, y: 0 },
  offset: { x: 22, y: 22 },
  pad: 16,
}

function slotAt(
  origin: { x: number; y: number },
  layout: HomeLayout,
  index: number
): { x: number; y: number } {
  const i = Math.max(0, Math.floor(index))
  return {
    x: origin.x + layout.start.x + i * layout.offset.x,
    y: origin.y + layout.start.y + i * layout.offset.y,
  }
}

/** Bottom-right face origin (local deck corner). */
function bottomRight(field: ParentSize, pad: number) {
  return {
    x: field.width - FACE.w - pad,
    y: field.height - FACE.h - pad,
  }
}

/** Top-left face origin (opp deck corner). */
function topLeft(_field: ParentSize, pad: number) {
  return { x: pad, y: pad }
}

/** Bottom-center face origin (above local hand). */
function bottomCenter(field: ParentSize, pad: number) {
  return {
    x: field.width / 2 - FACE.w / 2,
    y: field.height - FACE.h - pad,
  }
}

/** Top-center face origin (above opp hand / far edge). */
function topCenter(field: ParentSize, pad: number) {
  return {
    x: field.width / 2 - FACE.w / 2,
    y: pad,
  }
}

export function augmentHome(
  index: number,
  field: ParentSize,
  nearLocal: boolean
): { x: number; y: number } {
  const layout = AUGMENT_LAYOUT
  const origin = nearLocal
    ? bottomRight(field, layout.pad)
    : topLeft(field, layout.pad)
  if (nearLocal) return slotAt(origin, layout, index)
  // Opp mirrors the step direction so extras walk away from their deck edge.
  return {
    x: origin.x - layout.start.x + index * -layout.offset.x,
    y: origin.y - layout.start.y + index * -layout.offset.y,
  }
}

export function resourceHomeY(nearLocal: boolean, field: ParentSize): number {
  const layout = RESOURCE_FAN_LAYOUT
  const origin = nearLocal
    ? bottomCenter(field, layout.pad)
    : topCenter(field, layout.pad)
  return origin.y + layout.start.y
}

export function resourceAnchorX(nearLocal: boolean, field: ParentSize): number {
  const layout = RESOURCE_FAN_LAYOUT
  const origin = nearLocal
    ? bottomCenter(field, layout.pad)
    : topCenter(field, layout.pad)
  return origin.x + layout.start.x
}

/**
 * Mid-game generate / accumulate. `index` is burst-local (0, 1, 2…).
 */
export function generatedResourceHome(
  field: ParentSize,
  nearLocal: boolean,
  index: number
): { x: number; y: number } {
  const layout = GENERATED_LAYOUT
  const origin = nearLocal
    ? bottomCenter(field, layout.pad)
    : topCenter(field, layout.pad)
  if (nearLocal) return slotAt(origin, layout, index)
  return {
    x: origin.x + layout.start.x + index * layout.offset.x,
    y: origin.y + layout.start.y + index * -layout.offset.y,
  }
}

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
    if (card.cost.some((pip) => pip.trim().toUpperCase() === color)) {
      return color
    }
  }
  return "other"
}

/**
 * One fan per colour. First pile at bottom/top center + start; each next
 * colour shifts by ±(face + pad) along x; cards inside a pile use offset.
 */
export function layoutResourceFans(
  tokens: PlayingCardInstance[],
  nearLocal: boolean,
  field: ParentSize
): Map<string, { x: number; y: number }> {
  const layout = RESOURCE_FAN_LAYOUT
  const origin = nearLocal
    ? bottomCenter(field, layout.pad)
    : topCenter(field, layout.pad)

  const piles = new Map<string, PlayingCardInstance[]>()
  for (const color of RESOURCE_COLORS) piles.set(color, [])
  piles.set("other", [])
  for (const token of tokens) {
    piles.get(tokenColor(token))!.push(token)
  }

  const placed = new Map<string, { x: number; y: number }>()
  let pile = 0
  const pileStepX = nearLocal
    ? -(FACE.w + layout.pad)
    : FACE.w + layout.pad

  for (const key of [...RESOURCE_COLORS, "other" as const]) {
    const group = piles.get(key) ?? []
    if (group.length === 0) continue

    const pileOrigin = {
      x: origin.x + layout.start.x + pile * pileStepX,
      y: origin.y + layout.start.y,
    }

    group.forEach((card, index) => {
      placed.set(card.instanceId, {
        x: pileOrigin.x + index * layout.offset.x,
        y: pileOrigin.y + index * layout.offset.y,
      })
    })
    pile += 1
  }

  return placed
}

/**
 * Pin opening stockpile tokens into **world** space for `owner`.
 * World = p1's view: p1 fans sit at the bottom, p2 at the top. Each client
 * then runs `worldToView` so guest and host agree which side a token sits on.
 */
export function stampStockpileWorldHomes(
  tokens: PlayingCardInstance[],
  owner: PlayerSlot,
  field: ParentSize = PLAY_FLOAT_LOGICAL
): PlayingCardInstance[] {
  if (tokens.length === 0) return tokens
  // World space matches p1's screen: local fan for p1, opp fan for p2.
  const nearLocalInWorld = owner === PLAYER_SLOT.p1
  const homes = layoutResourceFans(tokens, nearLocalInWorld, field)
  return tokens.map((card) => {
    const home = homes.get(card.instanceId)
    return home ? { ...card, x: home.x, y: home.y } : card
  })
}

export function placeAugmentsForView(
  cards: PlayingCardInstance[],
  localSeat: PlayerSlot,
  field: ParentSize
): PlayingCardInstance[] {
  // Slot by stable id order — NOT session array order — so bring-to-front
  // on click cannot swap which augment sits in which layout slot.
  const homes = new Map<string, { x: number; y: number }>()

  for (const nearLocal of [true, false]) {
    const unbound = cards
      .filter(
        (card) =>
          card.isAugment &&
          card.x == null &&
          card.y == null &&
          (card.owner === localSeat) === nearLocal
      )
      .slice()
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId))

    unbound.forEach((card, index) => {
      homes.set(card.instanceId, augmentHome(index, field, nearLocal))
    })
  }

  return cards.map((card) => {
    const home = homes.get(card.instanceId)
    if (!home) return card
    return { ...card, x: home.x, y: home.y }
  })
}

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
    const home = byId.get(card.instanceId)
    if (!home) return card
    return { ...card, x: home.x, y: home.y }
  })
}

export function placeInPlayForView(
  cards: PlayingCardInstance[],
  localSeat: PlayerSlot,
  field: ParentSize
): PlayingCardInstance[] {
  const withHomes = placeStockpileForView(
    placeAugmentsForView(cards, localSeat, field),
    localSeat,
    field
  )

  // World x/y (opening stamps + drags) → this seat's view. Cards still missing
  // coords keep the viewer-relative homes from place*ForView above.
  return withHomes.map((card) => {
    const orig = cards.find((c) => c.instanceId === card.instanceId)
    if (orig == null || orig.x == null || orig.y == null) return card
    const view = worldToView(orig.x, orig.y, localSeat, field)
    return { ...card, x: view.x, y: view.y }
  })
}
