/**
 * Playtester card drag-drop between zones.
 *
 * Hit-tests DOM refs, then applies plans from `cardDragDrop.logic`
 * (priority, anim modes, face-down rules). Change drop rules there, not here.
 */

import type { Dispatch, RefObject, SetStateAction } from "react"

import {
  DROP_ZONE_PRIORITY,
  GROUP_FLIP_STEP_X,
  clearFloatSelection,
  elementToZoneRect,
  handCardsForBattlefield,
  landOffsetX,
  movableForHandDrop,
  movableForLibraryDrop,
  planHandDrop,
  planLibraryDrop,
  resolveDropZone,
  type DropSource,
  type DropZone,
  type DropZoneRects,
} from "@/components/Playtester/cardDragDrop.logic"
import { displayToWorld } from "@/components/Playtester/augmentRow.logic"
import { PLAY_FLOAT_LOGICAL } from "@/components/Playtester/playFieldScale.logic"
import type { PlayFx } from "@/components/Playtester/playNet.logic"
import {
  FLIP_FLY_MODE,
  LOCAL_SEAT,
  PLAY_ZONE,
  type PlayerSlot,
} from "@/components/Playtester/constants"
import type {
  FlipFlyAnim,
  PlaytesterZoneRefs,
} from "@/components/Playtester/useDrawAnimations"
import {
  type PlayingCardInstance,
  type SessionAction,
} from "@/components/Playtester/types"

export type UseCardDragDropArgs = {
  sessionCards: PlayingCardInstance[]
  setSessionCards: Dispatch<SetStateAction<PlayingCardInstance[]>>
  dispatch: (action: SessionAction) => unknown
  localSeat?: PlayerSlot
  /** Float logical size for view↔world (rooms: shared; solo: host-derived). */
  fieldSize?: { width: number; height: number }
  hideFlying?: (ids: string[]) => void
  zoneRefs: PlaytesterZoneRefs
  /**
   * When a search panel is open, its DOM node is an alternate hit target for
   * that zone (library / trashyard / dismantled) so cards can be dropped in.
   */
  searchDrop?: {
    zone: typeof PLAY_ZONE.library | typeof PLAY_ZONE.trashyard | typeof PLAY_ZONE.dismantled
    panelRef: RefObject<HTMLElement | null>
  } | null
  clientToSurfaceLocal: (clientX: number, clientY: number) => {
    x: number
    y: number
  }
  clientToStockpileLocal: (clientX: number, clientY: number) => {
    x: number
    y: number
  }
  isFlipFlying: () => boolean
  pushFlipAnim: (anim: Omit<FlipFlyAnim, "id">) => string
  emitFx?: (fx: PlayFx) => void
}

/** Reach a few px into the field so side / dock piles are easier to hit. */
const SIDE_PILE_HIT_PAD_PX = 48

function readDropRects(zoneRefs: PlaytesterZoneRefs): DropZoneRects {
  return {
    [PLAY_ZONE.library]: elementToZoneRect(zoneRefs.deck.current),
    [PLAY_ZONE.trashyard]: elementToZoneRect(zoneRefs.trash.current),
    [PLAY_ZONE.dismantled]: elementToZoneRect(zoneRefs.dismantled.current),
    // Pilot sits beside the hand — pad upward into the field, not into the hand.
    [PLAY_ZONE.pilot]: elementToZoneRect(zoneRefs.pilot.current, {
      padTop: SIDE_PILE_HIT_PAD_PX,
    }),
    [PLAY_ZONE.hand]: elementToZoneRect(zoneRefs.hand.current),
    [PLAY_ZONE.battlefield]: elementToZoneRect(zoneRefs.surface.current),
  }
}

function readSearchDropOverlays(
  searchDrop: UseCardDragDropArgs["searchDrop"]
): DropZoneRects | null {
  if (!searchDrop) return null
  const rect = elementToZoneRect(searchDrop.panelRef.current)
  if (!rect) return null
  return { [searchDrop.zone]: rect }
}

export function useCardDragDrop({
  sessionCards,
  setSessionCards,
  dispatch,
  localSeat = LOCAL_SEAT,
  fieldSize = PLAY_FLOAT_LOGICAL,
  hideFlying,
  zoneRefs,
  searchDrop = null,
  clientToSurfaceLocal,
  clientToStockpileLocal,
  isFlipFlying,
  pushFlipAnim,
  emitFx,
}: UseCardDragDropArgs) {
  function ownIds(ids: string[]): string[] {
    return ids.filter((id) =>
      sessionCards.some((c) => c.instanceId === id && c.owner === localSeat)
    )
  }

  function moveOwned(ids: string[], z: typeof PLAY_ZONE[keyof typeof PLAY_ZONE], x?: number, y?: number) {
    const i = ownIds(ids)
    if (i.length === 0) return
    let worldX = x
    let worldY = y
    if (x != null && y != null) {
      const world = displayToWorld(x, y, localSeat, fieldSize)
      worldX = world.x
      worldY = world.y
    }
    dispatch({ t: "mv", seat: localSeat, i, z, x: worldX, y: worldY })
    setSessionCards((prev) => clearFloatSelection(prev, localSeat))
  }
  function applyLibraryDrop(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    const movable = movableForLibraryDrop(sessionCards, instanceIds)
    const plan = planLibraryDrop(movable, isFlipFlying())
    if (plan.kind === "blocked" || plan.kind === "none") return false

    if (plan.kind === "destroyOnly") {
      dispatch({ t: "rm", i: ownIds(plan.resourceIds) })
      setSessionCards((prev) => clearFloatSelection(prev, localSeat))
      return true
    }

    if (plan.destroyResourceIds.length > 0) {
      dispatch({ t: "rm", i: ownIds(plan.destroyResourceIds) })
    }

    if (plan.kind === "animate") {
      const deckRect = zoneRefs.deck.current?.getBoundingClientRect()
      const w = deckRect?.width ?? 112
      const h = deckRect?.height ?? 144
      const sourceZone = plan.card.zone
      hideFlying?.([plan.card.instanceId])
      moveOwned([plan.card.instanceId], PLAY_ZONE.library)
      pushFlipAnim({
        card: plan.card,
        mode: plan.mode,
        from: {
          x: clientX - w / 2,
          y: clientY - h / 2,
          w,
          h,
        },
        to: {
          x: deckRect?.left ?? clientX,
          y: deckRect?.top ?? clientY,
        },
        landZone: PLAY_ZONE.library,
        alreadyCommitted: true,
      })
      const fxFrom =
        sourceZone === PLAY_ZONE.hand
          ? "hand"
          : sourceZone === PLAY_ZONE.stockpile
            ? "stockpile"
            : sourceZone === PLAY_ZONE.trashyard
              ? "trashyard"
              : sourceZone === PLAY_ZONE.dismantled
                ? "dismantled"
                : sourceZone === PLAY_ZONE.pilot
                  ? "pilot"
                  : "battlefield"
      emitFx?.({
        kind: "fly",
        mode: FLIP_FLY_MODE.faceDown,
        from: fxFrom,
        to: "library",
        faceDown: true,
      })
      return true
    }

    moveOwned(
      plan.cards.map((c) => c.instanceId),
      PLAY_ZONE.library
    )
    return true
  }

  function applyHandDrop(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    const movable = movableForHandDrop(sessionCards, instanceIds)
    const plan = planHandDrop(movable, isFlipFlying())
    if (plan.kind === "empty") return true

    moveOwned(
      plan.instant.map((c) => c.instanceId),
      PLAY_ZONE.hand
    )

    if (plan.toFlip.length === 0) return true

    const handRect = zoneRefs.hand.current?.getBoundingClientRect()
    const deckRect = zoneRefs.deck.current?.getBoundingClientRect()
    const w = deckRect?.width ?? 112
    const h = deckRect?.height ?? 144

    hideFlying?.(plan.toFlip.map((c) => c.instanceId))
    moveOwned(
      plan.toFlip.map((c) => c.instanceId),
      PLAY_ZONE.hand
    )

    plan.toFlip.forEach((card, index) => {
      const offset = index * GROUP_FLIP_STEP_X
      pushFlipAnim({
        card,
        mode: FLIP_FLY_MODE.draw,
        from: {
          x: clientX - w / 2 + landOffsetX(index),
          y: clientY - h / 2,
          w,
          h,
        },
        to: {
          x: (handRect?.right ?? clientX) - w - 12 - offset,
          y:
            (handRect?.top ?? clientY) +
            ((handRect?.height ?? h) - h) / 2,
        },
        landZone: PLAY_ZONE.hand,
        alreadyCommitted: true,
      })
    })
    emitFx?.({
      kind: "fly",
      mode: FLIP_FLY_MODE.draw,
      from: "battlefield",
      to: "hand",
      n: plan.toFlip.length,
      faceDown: true,
    })
    return true
  }

  function applyTrashDrop(instanceIds: string[]) {
    moveOwned(instanceIds, PLAY_ZONE.trashyard)
  }

  function applyDismantledDrop(instanceIds: string[]) {
    moveOwned(instanceIds, PLAY_ZONE.dismantled)
  }

  function applyPilotDrop(instanceIds: string[]) {
    const id = instanceIds[0]
    if (!id) return
    moveOwned([id], PLAY_ZONE.pilot)
  }

  function applyStockpileDrop(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    const { x, y } = clientToStockpileLocal(clientX, clientY)
    instanceIds.forEach((id, index) => {
      moveOwned([id], PLAY_ZONE.stockpile, x + landOffsetX(index), y)
    })
  }

  function applyBattlefieldDrop(
    instanceIds: string[],
    clientX: number,
    clientY: number,
    fromHandOnly: boolean
  ) {
    const { x, y } = clientToSurfaceLocal(clientX, clientY)
    const ids = fromHandOnly
      ? handCardsForBattlefield(sessionCards, instanceIds)
      : instanceIds
    if (ids.length === 0) return
    ids.forEach((id, index) => {
      moveOwned([id], PLAY_ZONE.battlefield, x + landOffsetX(index), y)
    })
    dispatch({ t: "fr", i: ids[ids.length - 1]! })
  }

  function applyDrop(
    source: DropSource,
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (instanceIds.length === 0) return false

    const zone = resolveDropZone(
      clientX,
      clientY,
      readDropRects(zoneRefs),
      source,
      readSearchDropOverlays(searchDrop)
    )
    if (!zone) return false

    switch (zone) {
      case PLAY_ZONE.library:
        return applyLibraryDrop(instanceIds, clientX, clientY)
      case PLAY_ZONE.trashyard:
        applyTrashDrop(instanceIds)
        return true
      case PLAY_ZONE.dismantled:
        applyDismantledDrop(instanceIds)
        return true
      case PLAY_ZONE.pilot:
        applyPilotDrop(instanceIds)
        return true
      case PLAY_ZONE.stockpile:
        applyStockpileDrop(instanceIds, clientX, clientY)
        return true
      case PLAY_ZONE.hand:
        return applyHandDrop(instanceIds, clientX, clientY)
      case PLAY_ZONE.battlefield:
        applyBattlefieldDrop(
          instanceIds,
          clientX,
          clientY,
          source === "hand"
        )
        return true
      default: {
        const _exhaustive: never = zone
        return _exhaustive
      }
    }
  }

  function onHandRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    return applyDrop("hand", instanceIds, clientX, clientY)
  }

  function onBattlefieldRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    return applyDrop("battlefield", instanceIds, clientX, clientY)
  }

  function onStockpileRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    return applyDrop("stockpile", instanceIds, clientX, clientY)
  }

  function onFaceUpPileRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    return applyDrop("faceUpPile", instanceIds, clientX, clientY)
  }

  function onLibraryCardRelease(
    instanceId: string,
    clientX: number,
    clientY: number
  ) {
    const card = sessionCards.find(
      (c) => c.instanceId === instanceId && c.zone === PLAY_ZONE.library
    )
    if (!card) return
    onFaceUpPileRelease([instanceId], clientX, clientY)
  }

  return {
    onHandRelease,
    onBattlefieldRelease,
    onStockpileRelease,
    onFaceUpPileRelease,
    onLibraryCardRelease,
  }
}

/** Re-export priority for debugging / docs — single source remains the logic module. */
export { DROP_ZONE_PRIORITY }
export type { DropSource, DropZone }
