/**
 * Playtester card drag-drop between zones.
 *
 * Hit-tests DOM refs, then applies plans from `cardDragDrop.logic`
 * (priority, anim modes, face-down rules). Change drop rules there, not here.
 */

import type { Dispatch, SetStateAction } from "react"

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
import {
  FLIP_FLY_MODE,
  LOCAL_SEAT,
  PLAY_ZONE,
  type PlayerSlot,
} from "@/components/Playtester/playtesterConstants"
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
  hideFlying?: (ids: string[]) => void
  zoneRefs: PlaytesterZoneRefs
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
}

function readDropRects(zoneRefs: PlaytesterZoneRefs): DropZoneRects {
  return {
    [PLAY_ZONE.library]: elementToZoneRect(zoneRefs.deck.current),
    [PLAY_ZONE.trashyard]: elementToZoneRect(zoneRefs.trash.current),
    [PLAY_ZONE.dismantled]: elementToZoneRect(zoneRefs.dismantled.current),
    [PLAY_ZONE.pilot]: elementToZoneRect(zoneRefs.pilot.current),
    [PLAY_ZONE.hand]: elementToZoneRect(zoneRefs.hand.current),
    [PLAY_ZONE.battlefield]: elementToZoneRect(zoneRefs.surface.current),
  }
}

export function useCardDragDrop({
  sessionCards,
  setSessionCards,
  dispatch,
  localSeat = LOCAL_SEAT,
  hideFlying,
  zoneRefs,
  clientToSurfaceLocal,
  clientToStockpileLocal,
  isFlipFlying,
  pushFlipAnim,
}: UseCardDragDropArgs) {
  function ownIds(ids: string[]): string[] {
    return ids.filter((id) =>
      sessionCards.some((c) => c.instanceId === id && c.owner === localSeat)
    )
  }

  function moveOwned(ids: string[], z: typeof PLAY_ZONE[keyof typeof PLAY_ZONE], x?: number, y?: number) {
    const i = ownIds(ids)
    if (i.length === 0) return
    dispatch({ t: "mv", seat: localSeat, i, z, x, y })
    setSessionCards((prev) => clearFloatSelection(prev))
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
      setSessionCards((prev) => clearFloatSelection(prev))
      return true
    }

    if (plan.destroyResourceIds.length > 0) {
      dispatch({ t: "rm", i: ownIds(plan.destroyResourceIds) })
    }

    if (plan.kind === "animate") {
      const deckRect = zoneRefs.deck.current?.getBoundingClientRect()
      const w = deckRect?.width ?? 112
      const h = deckRect?.height ?? 144
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
      source
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
  ) {
    applyDrop("hand", instanceIds, clientX, clientY)
  }

  function onBattlefieldRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    applyDrop("battlefield", instanceIds, clientX, clientY)
  }

  function onStockpileRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    applyDrop("stockpile", instanceIds, clientX, clientY)
  }

  function onFaceUpPileRelease(
    instanceId: string,
    clientX: number,
    clientY: number
  ) {
    applyDrop("faceUpPile", [instanceId], clientX, clientY)
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
    onFaceUpPileRelease(instanceId, clientX, clientY)
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
