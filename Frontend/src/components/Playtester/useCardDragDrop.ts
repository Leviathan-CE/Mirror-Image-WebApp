/**
 * Playtester card drag-drop between zones.
 * Hit-tests zone refs and applies moves; flip-to-library uses pushFlipAnim from draw hook.
 */

import type { Dispatch, SetStateAction } from "react"

import { FLIP_FLY_MODE, PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import type {
  FlipFlyAnim,
  PlaytesterZoneRefs,
} from "@/components/Playtester/useDrawAnimations"
import {
  isResourceTokenInstance,
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

function pointInRect(
  clientX: number,
  clientY: number,
  el: HTMLElement | null
): boolean {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  )
}

function clearFloatSelection(
  cards: PlayingCardInstance[]
): PlayingCardInstance[] {
  return cards.map((c) =>
    (c.zone === PLAY_ZONE.battlefield ||
      c.zone === PLAY_ZONE.stockpile ||
      c.zone === PLAY_ZONE.hand) &&
    c.selected
      ? { ...c, selected: false }
      : c
  )
}

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

export function useCardDragDrop({
  sessionCards,
  setSessionCards,
  zoneRefs,
  clientToSurfaceLocal,
  clientToStockpileLocal,
  isFlipFlying,
  pushFlipAnim,
}: UseCardDragDropArgs) {
  function tryPutGroupOnDeck(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (isFlipFlying()) return false
    const deckEl = zoneRefs.deck.current
    if (!deckEl || !pointInRect(clientX, clientY, deckEl)) return false

    const movable = instanceIds
      .map((id) => sessionCards.find((c) => c.instanceId === id))
      .filter(
        (c): c is PlayingCardInstance => Boolean(c && c.zone !== PLAY_ZONE.library)
      )
    if (movable.length === 0) return false

    const resources = movable.filter((c) => isResourceTokenInstance(c))
    const cards = movable.filter((c) => !isResourceTokenInstance(c))

    if (resources.length > 0 && cards.length === 0) {
      setSessionCards((prev) => {
        let next = prev
        for (const card of resources) {
          next = removeCard(next, card.instanceId)
        }
        return clearFloatSelection(next)
      })
      return true
    }

    if (resources.length > 0) {
      setSessionCards((prev) => {
        let next = prev
        for (const card of resources) {
          next = removeCard(next, card.instanceId)
        }
        return next
      })
    }

    if (cards.length === 0) return true

    if (cards.length === 1) {
      const card = cards[0]!
      const deckRect = deckEl.getBoundingClientRect()
      const w = deckRect.width
      const h = deckRect.height
      setSessionCards((prev) =>
        clearFloatSelection(removeCard(prev, card.instanceId))
      )
      pushFlipAnim({
        card,
        mode: FLIP_FLY_MODE.put,
        from: {
          x: clientX - w / 2,
          y: clientY - h / 2,
          w,
          h,
        },
        to: { x: deckRect.left, y: deckRect.top },
        landZone: PLAY_ZONE.library,
      })
      return true
    }

    setSessionCards((prev) => {
      let next = prev
      for (const card of cards) {
        next = removeCard(next, card.instanceId)
        next = putCardOnLibraryTop(next, card)
      }
      return clearFloatSelection(next)
    })
    return true
  }

  function tryPutGroupOnTrashyard(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, zoneRefs.trash.current)) return false
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        const card = next.find((c) => c.instanceId === id)
        if (!card || card.zone === PLAY_ZONE.trashyard) continue
        next = moveToTrashyard(next, id)
      }
      return clearFloatSelection(next)
    })
    return true
  }

  function tryPutGroupOnDismantled(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, zoneRefs.dismantled.current)) return false
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        const card = next.find((c) => c.instanceId === id)
        if (!card || card.zone === PLAY_ZONE.dismantled) continue
        next = moveToDismantled(next, id)
      }
      return clearFloatSelection(next)
    })
    return true
  }

  function tryPutGroupOnStockpile(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, zoneRefs.stockpile.current)) return false
    const { x, y } = clientToStockpileLocal(clientX, clientY)
    setSessionCards((prev) => {
      let next = prev
      instanceIds.forEach((id, index) => {
        if (!next.some((c) => c.instanceId === id)) return
        next = moveToStockpile(next, id, x + index * 24, y)
      })
      return clearFloatSelection(next)
    })
    return true
  }

  function tryPutGroupOnPilot(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, zoneRefs.pilot.current)) return false
    const id = instanceIds[0]
    if (!id) return false
    setSessionCards((prev) => clearFloatSelection(moveToPilot(prev, id)))
    return true
  }

  function onHandRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    if (instanceIds.length === 0) return
    if (tryPutGroupOnDeck(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnTrashyard(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnDismantled(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnPilot(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnStockpile(instanceIds, clientX, clientY)) return
    if (!pointInRect(clientX, clientY, zoneRefs.surface.current)) return
    const { x, y } = clientToSurfaceLocal(clientX, clientY)
    setSessionCards((prev) => {
      let next = prev
      instanceIds.forEach((id, index) => {
        if (
          !next.some(
            (c) => c.instanceId === id && c.zone === PLAY_ZONE.hand
          )
        ) {
          return
        }
        next = moveCardtoFront(
          moveToBattlefield(next, id, x + index * 24, y),
          id
        )
      })
      return clearFloatSelection(next)
    })
  }

  function onBattlefieldRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    if (tryPutGroupOnDeck(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnTrashyard(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnDismantled(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnPilot(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnStockpile(instanceIds, clientX, clientY)) return
    if (pointInRect(clientX, clientY, zoneRefs.hand.current)) {
      setSessionCards((prev) => {
        let next = prev
        for (const id of instanceIds) {
          next = moveToHand(next, id)
        }
        return clearFloatSelection(next)
      })
    }
  }

  function onStockpileRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    if (tryPutGroupOnDeck(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnTrashyard(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnDismantled(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnPilot(instanceIds, clientX, clientY)) return
    if (pointInRect(clientX, clientY, zoneRefs.hand.current)) {
      setSessionCards((prev) => {
        let next = prev
        for (const id of instanceIds) {
          next = moveToHand(next, id)
        }
        return clearFloatSelection(next)
      })
      return
    }
    if (pointInRect(clientX, clientY, zoneRefs.surface.current)) {
      const { x, y } = clientToSurfaceLocal(clientX, clientY)
      setSessionCards((prev) => {
        let next = prev
        instanceIds.forEach((id, index) => {
          next = moveCardtoFront(
            moveToBattlefield(next, id, x + index * 24, y),
            id
          )
        })
        return clearFloatSelection(next)
      })
    }
  }

  function onFaceUpPileRelease(
    instanceId: string,
    clientX: number,
    clientY: number
  ) {
    if (tryPutGroupOnDeck([instanceId], clientX, clientY)) return
    if (tryPutGroupOnTrashyard([instanceId], clientX, clientY)) return
    if (tryPutGroupOnDismantled([instanceId], clientX, clientY)) return
    if (tryPutGroupOnPilot([instanceId], clientX, clientY)) return
    if (tryPutGroupOnStockpile([instanceId], clientX, clientY)) return
    if (pointInRect(clientX, clientY, zoneRefs.hand.current)) {
      setSessionCards((prev) => moveToHand(prev, instanceId))
      return
    }
    if (pointInRect(clientX, clientY, zoneRefs.surface.current)) {
      const { x, y } = clientToSurfaceLocal(clientX, clientY)
      setSessionCards((prev) =>
        moveCardtoFront(moveToBattlefield(prev, instanceId, x, y), instanceId)
      )
    }
  }

  /** Drag a specific library card (e.g. from Search deck) onto a zone. */
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
