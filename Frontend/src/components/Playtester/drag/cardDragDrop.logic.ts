/**
 * Pure drag/drop rules for the playtester.
 *
 * Zone priority, library put anim mode, and hand face-down flip policy live
 * here so `useCardDragDrop` only reads DOM rects and applies the plan.
 */

import {
  FLIP_FLY_MODE,
  PLAY_ZONE,
  type FlipFlyMode,
  type PlayerSlot,
} from "@/components/Playtester/constants"
import { isSessionTokenInstance } from "@/components/Playtester/session/sessionResources.logic"
import type { PlayingCardInstance } from "@/components/Playtester/session/playCard.logic"

export type ZoneRect = {
  left: number
  top: number
  right: number
  bottom: number
}

/** Zones a dragged card can land on. */
export type DropZone =
  | typeof PLAY_ZONE.library
  | typeof PLAY_ZONE.trashyard
  | typeof PLAY_ZONE.dismantled
  | typeof PLAY_ZONE.pilot
  | typeof PLAY_ZONE.stockpile
  | typeof PLAY_ZONE.hand
  | typeof PLAY_ZONE.battlefield

/** Where the drag started — each source has its own hit-test order. */
export type DropSource = "hand" | "battlefield" | "stockpile" | "faceUpPile"

/**
 * First matching zone wins. Change landing priority only here.
 * `battlefield` is the one in-play table. Dragging a card already on the
 * table does not rezone it (LEAVE_FIELD omits the table itself).
 */
const LEAVE_FIELD: readonly DropZone[] = [
  PLAY_ZONE.library,
  PLAY_ZONE.trashyard,
  PLAY_ZONE.dismantled,
  PLAY_ZONE.pilot,
  PLAY_ZONE.hand,
]

export const DROP_ZONE_PRIORITY: Record<DropSource, readonly DropZone[]> = {
  hand: [
    PLAY_ZONE.library,
    PLAY_ZONE.trashyard,
    PLAY_ZONE.dismantled,
    PLAY_ZONE.pilot,
    PLAY_ZONE.hand,
    PLAY_ZONE.battlefield,
  ],
  battlefield: LEAVE_FIELD,
  stockpile: LEAVE_FIELD,
  faceUpPile: [
    PLAY_ZONE.library,
    PLAY_ZONE.trashyard,
    PLAY_ZONE.dismantled,
    PLAY_ZONE.pilot,
    PLAY_ZONE.hand,
    PLAY_ZONE.battlefield,
  ],
}

export function pointInZoneRect(
  clientX: number,
  clientY: number,
  rect: ZoneRect | null | undefined
): boolean {
  if (!rect) return false
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

export type ZoneRectPad = {
  padLeft?: number
  padRight?: number
  padTop?: number
  padBottom?: number
}

export function elementToZoneRect(
  el: HTMLElement | null | undefined,
  pad?: ZoneRectPad
): ZoneRect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    left: r.left - (pad?.padLeft ?? 0),
    top: r.top - (pad?.padTop ?? 0),
    right: r.right + (pad?.padRight ?? 0),
    bottom: r.bottom + (pad?.padBottom ?? 0),
  }
}

export type DropZoneRects = Partial<Record<DropZone, ZoneRect | null>>

/** Resolve which zone the pointer is over, using the source's priority list.
 *  `overlays` are checked first per zone (e.g. open search panel = that pile). */
export function resolveDropZone(
  clientX: number,
  clientY: number,
  rects: DropZoneRects,
  source: DropSource,
  overlays?: DropZoneRects | null
): DropZone | null {
  for (const zone of DROP_ZONE_PRIORITY[source]) {
    if (pointInZoneRect(clientX, clientY, overlays?.[zone])) return zone
    if (pointInZoneRect(clientX, clientY, rects[zone])) return zone
  }
  return null
}

/**
 * Fly mode when seating a card onto the library top.
 * Face-down cards slide (no flip); face-up cards flip to the back.
 */
export function libraryPutFlyMode(
  card: Pick<PlayingCardInstance, "faceDown">
): FlipFlyMode {
  return card.faceDown ? FLIP_FLY_MODE.faceDown : FLIP_FLY_MODE.put
}

/** Face-down non-tokens flip into hand; everything else seats immediately. */
export function shouldFlipIntoHand(
  card: PlayingCardInstance,
  flipBusy: boolean
): boolean {
  return Boolean(card.faceDown) && !isSessionTokenInstance(card) && !flipBusy
}

export function clearFloatSelection(
  cards: PlayingCardInstance[],
  owner?: PlayerSlot
): PlayingCardInstance[] {
  return cards.map((c) =>
    (c.zone === PLAY_ZONE.battlefield ||
      c.zone === PLAY_ZONE.stockpile ||
      c.zone === PLAY_ZONE.hand) &&
    c.selected &&
    (owner == null || c.owner === owner)
      ? { ...c, selected: false }
      : c
  )
}

/** Cards eligible to leave their current zone for a library drop. */
export function movableForLibraryDrop(
  sessionCards: PlayingCardInstance[],
  instanceIds: string[]
): PlayingCardInstance[] {
  return instanceIds
    .map((id) => sessionCards.find((c) => c.instanceId === id))
    .filter(
      (c): c is PlayingCardInstance =>
        Boolean(c && c.zone !== PLAY_ZONE.library)
    )
}

export function splitResourceAndCards(movable: PlayingCardInstance[]): {
  resources: PlayingCardInstance[]
  cards: PlayingCardInstance[]
} {
  return {
    resources: movable.filter((c) => isSessionTokenInstance(c)),
    cards: movable.filter((c) => !isSessionTokenInstance(c)),
  }
}

export type LibraryDropPlan =
  | { kind: "blocked" }
  | { kind: "none" }
  | { kind: "destroyOnly"; resourceIds: string[] }
  | {
      kind: "animate"
      card: PlayingCardInstance
      mode: FlipFlyMode
      destroyResourceIds: string[]
    }
  | {
      kind: "instant"
      cards: PlayingCardInstance[]
      destroyResourceIds: string[]
    }

/**
 * What to do once the pointer is already over the library.
 * `blocked` means flip overlay busy — caller should not consume the drop
 * (other zones may still be tried).
 */
export function planLibraryDrop(
  movable: PlayingCardInstance[],
  flipBusy: boolean
): LibraryDropPlan {
  if (flipBusy) return { kind: "blocked" }
  if (movable.length === 0) return { kind: "none" }

  const { resources, cards } = splitResourceAndCards(movable)
  const destroyResourceIds = resources.map((c) => c.instanceId)

  if (cards.length === 0) {
    return { kind: "destroyOnly", resourceIds: destroyResourceIds }
  }

  if (cards.length === 1) {
    const card = cards[0]!
    return {
      kind: "animate",
      card,
      mode: libraryPutFlyMode(card),
      destroyResourceIds,
    }
  }

  return { kind: "instant", cards, destroyResourceIds }
}

export type HandDropPlan =
  | { kind: "empty" }
  | {
      kind: "seat"
      /** Seat now (face-up, tokens, or face-down when flip is busy). */
      instant: PlayingCardInstance[]
      /** Remove from session and fly with draw flip. */
      toFlip: PlayingCardInstance[]
    }

export function movableForHandDrop(
  sessionCards: PlayingCardInstance[],
  instanceIds: string[]
): PlayingCardInstance[] {
  return instanceIds
    .map((id) => sessionCards.find((c) => c.instanceId === id))
    .filter((c): c is PlayingCardInstance => Boolean(c))
}

export function planHandDrop(
  movable: PlayingCardInstance[],
  flipBusy: boolean
): HandDropPlan {
  if (movable.length === 0) return { kind: "empty" }

  const toFlip = movable.filter((c) => shouldFlipIntoHand(c, flipBusy))
  const flipIds = new Set(toFlip.map((c) => c.instanceId))
  const instant = movable.filter((c) => !flipIds.has(c.instanceId))

  return { kind: "seat", instant, toFlip }
}

/** Hand → battlefield only moves cards that are still in hand. */
export function handCardsForBattlefield(
  sessionCards: PlayingCardInstance[],
  instanceIds: string[]
): string[] {
  return instanceIds.filter((id) =>
    sessionCards.some((c) => c.instanceId === id && c.zone === PLAY_ZONE.hand)
  )
}

export type FreeFloatLand = {
  zone: typeof PLAY_ZONE.battlefield | typeof PLAY_ZONE.stockpile
  /** Local origin for the primary card; callers offset group members. */
  x: number
  y: number
}

/**
 * Group stagger used when seating several cards in a free-float zone.
 * Kept here so layout spacing and tests share one constant.
 */
export const GROUP_LAND_STEP_X = 24
export const GROUP_FLIP_STEP_X = 18

export function landOffsetX(index: number): number {
  return index * GROUP_LAND_STEP_X
}
