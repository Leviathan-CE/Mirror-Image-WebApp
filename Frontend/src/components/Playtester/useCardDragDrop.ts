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
  PLAY_ZONE,
} from "@/components/Playtester/playtesterConstants"
import type {
  FlipFlyAnim,
  PlaytesterZoneRefs,
} from "@/components/Playtester/useDrawAnimations"
import {
  moveCardtoFront,
  moveToBattlefield,
  moveToDismantled,
  moveToHand,
  moveToPilot,
  moveToStockpile,
  moveToTrashyard,
  putCardOnLibraryTop,
  removeCard,
  type PlayingCardInstance,
} from "@/components/Playtester/types"

export type UseCardDragDropArgs = {
  sessionCards: PlayingCardInstance[]
  setSessionCards: Dispatch<SetStateAction<PlayingCardInstance[]>>
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
    [PLAY_ZONE.stockpile]: elementToZoneRect(zoneRefs.stockpile.current),
    [PLAY_ZONE.hand]: elementToZoneRect(zoneRefs.hand.current),
    [PLAY_ZONE.battlefield]: elementToZoneRect(zoneRefs.surface.current),
  }
}

export function useCardDragDrop({
  sessionCards,
  setSessionCards,
  zoneRefs,
  clientToSurfaceLocal,
  clientToStockpileLocal,
  isFlipFlying,
  pushFlipAnim,
}: UseCardDragDropArgs) {
  function applyLibraryDrop(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    const movable = movableForLibraryDrop(sessionCards, instanceIds)
    const plan = planLibraryDrop(movable, isFlipFlying())
    if (plan.kind === "blocked" || plan.kind === "none") return false

    const destroy = (ids: string[]) => {
      if (ids.length === 0) return
      setSessionCards((prev) => {
        let next = prev
        for (const id of ids) next = removeCard(next, id)
        return next
      })
    }

    if (plan.kind === "destroyOnly") {
      setSessionCards((prev) => {
        let next = prev
        for (const id of plan.resourceIds) next = removeCard(next, id)
        return clearFloatSelection(next)
      })
      return true
    }

    destroy(plan.destroyResourceIds)

    if (plan.kind === "animate") {
      const deckRect = zoneRefs.deck.current?.getBoundingClientRect()
      const w = deckRect?.width ?? 112
      const h = deckRect?.height ?? 144
      setSessionCards((prev) =>
        clearFloatSelection(removeCard(prev, plan.card.instanceId))
      )
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
      })
      return true
    }

    setSessionCards((prev) => {
      let next = prev
      for (const card of plan.cards) {
        next = removeCard(next, card.instanceId)
        next = putCardOnLibraryTop(next, card)
      }
      return clearFloatSelection(next)
    })
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

    setSessionCards((prev) => {
      let next = prev
      for (const card of plan.instant) {
        next = moveToHand(next, card.instanceId)
      }
      for (const card of plan.toFlip) {
        next = removeCard(next, card.instanceId)
      }
      return clearFloatSelection(next)
    })

    if (plan.toFlip.length === 0) return true

    const handRect = zoneRefs.hand.current?.getBoundingClientRect()
    const deckRect = zoneRefs.deck.current?.getBoundingClientRect()
    const w = deckRect?.width ?? 112
    const h = deckRect?.height ?? 144

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
      })
    })
    return true
  }

  function applyTrashDrop(instanceIds: string[]) {
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        const card = next.find((c) => c.instanceId === id)
        if (!card || card.zone === PLAY_ZONE.trashyard) continue
        next = moveToTrashyard(next, id)
      }
      return clearFloatSelection(next)
    })
  }

  function applyDismantledDrop(instanceIds: string[]) {
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        const card = next.find((c) => c.instanceId === id)
        if (!card || card.zone === PLAY_ZONE.dismantled) continue
        next = moveToDismantled(next, id)
      }
      return clearFloatSelection(next)
    })
  }

  function applyPilotDrop(instanceIds: string[]) {
    const id = instanceIds[0]
    if (!id) return
    setSessionCards((prev) => clearFloatSelection(moveToPilot(prev, id)))
  }

  function applyStockpileDrop(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    const { x, y } = clientToStockpileLocal(clientX, clientY)
    setSessionCards((prev) => {
      let next = prev
      instanceIds.forEach((id, index) => {
        if (!next.some((c) => c.instanceId === id)) return
        next = moveToStockpile(next, id, x + landOffsetX(index), y)
      })
      return clearFloatSelection(next)
    })
  }

  function applyBattlefieldDrop(
    instanceIds: string[],
    clientX: number,
    clientY: number,
    /** When true, only seat cards that are still in hand. */
    fromHandOnly: boolean
  ) {
    const { x, y } = clientToSurfaceLocal(clientX, clientY)
    const ids = fromHandOnly
      ? handCardsForBattlefield(sessionCards, instanceIds)
      : instanceIds
    if (ids.length === 0) return

    setSessionCards((prev) => {
      let next = prev
      ids.forEach((id, index) => {
        if (fromHandOnly) {
          if (
            !next.some(
              (c) => c.instanceId === id && c.zone === PLAY_ZONE.hand
            )
          ) {
            return
          }
        } else if (!next.some((c) => c.instanceId === id)) {
          return
        }
        next = moveCardtoFront(
          moveToBattlefield(next, id, x + landOffsetX(index), y),
          id
        )
      })
      return clearFloatSelection(next)
    })
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
