/**
 * Playtester session core: card bag + turn/life/pilot + pure mutators.
 * DOM, overlays, and animation queues stay on the page (via `effectsRef`).
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"

import {
  spawnResourceTokenInstance,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources.logic"
import {
  putTopLibraryOnBottom,
  reorderTopLibrary,
  shuffleLibrary,
} from "@/components/Playtester/deckActions.logic"
import { PILOT_GEN_MAX, PLAY_ZONE } from "@/components/Playtester/playtesterConstants"
import {
  applyMulliganToBottom,
  setupOpeningSession,
  startingLifeFromPilot,
} from "@/components/Playtester/setupOpeningSession.logic"
import {
  adjustCardCounter,
  cardsInZone,
  duplicatePlayingCards,
  extractStockpileTimeCompletions,
  moveAllFromZone,
  moveCardtoBack,
  moveCardtoFront,
  putCardsOnLibraryBottom,
  readyBattlefieldAndStockpile,
  setCardsFaceDown,
  toggleExpended,
  type CardCounterKind,
  type MoveAllDestinationZone,
  type MoveAllSourceZone,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import { pilotCard } from "@/components/decks/deck.logic"
import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckDetail } from "@/lib/api/decks"
import type { DeckLoadStatus } from "@/hooks/useDeckDetail"
import { peekTopLibrary } from "@/components/Playtester/deckActions.logic"

/** Animation / timer side-effects the page wires after `useDrawAnimations`. */
export type PlaySessionEffects = {
  clearDrawTimers: () => void
  queueStockpileTimeCompletions: (launching: PlayingCardInstance[]) => void
  queueDrawsToHand: (count: number) => void
}

export type UsePlaySessionArgs = {
  status: DeckLoadStatus
  deck: DeckDetail | null
  resourceByColor: Map<ResourceColor, CardLibraryItem>
  resourcesReady: boolean
  effectsRef: MutableRefObject<Partial<PlaySessionEffects>>
}

export function usePlaySession({
  status,
  deck,
  resourceByColor,
  resourcesReady,
  effectsRef,
}: UsePlaySessionArgs) {
  const [sessionCardsState, setSessionCardsState] = useState<
    PlayingCardInstance[]
  >([])
  const sessionCardsRef = useRef<PlayingCardInstance[]>([])
  sessionCardsRef.current = sessionCardsState

  /** Always dual-write the mutable mirror used by draw/flip timers. */
  const setSessionCards: Dispatch<SetStateAction<PlayingCardInstance[]>> = (
    action
  ) => {
    setSessionCardsState((prev) => {
      const next = typeof action === "function" ? action(prev) : action
      sessionCardsRef.current = next
      return next
    })
  }

  function commitCards(next: PlayingCardInstance[]) {
    sessionCardsRef.current = next
    setSessionCardsState(next)
  }

  const [life, setLife] = useState(0)
  const [turn, setTurn] = useState(1)
  const [pilotGenBonus, setPilotGenBonus] = useState(0)
  const [pilotHandSize, setPilotHandSize] = useState(0)
  const [mulliganOpen, setMulliganOpen] = useState(false)
  const [topRevealed, setTopRevealed] = useState(false)

  useEffect(() => {
    if (status !== "ready" || !deck) {
      commitCards([])
      setLife(0)
      setTurn(1)
      setPilotGenBonus(0)
      setPilotHandSize(0)
      setMulliganOpen(false)
      setTopRevealed(false)
      effectsRef.current.clearDrawTimers?.()
      return
    }
    if (!resourcesReady) return

    const opening = setupOpeningSession(deck, resourceByColor)
    const pilot = pilotCard(deck.cards, deck.categories)
    commitCards(opening)
    setLife(startingLifeFromPilot(pilot))
    setTurn(1)
    setPilotGenBonus(0)
    setPilotHandSize(Math.max(0, Math.floor(pilot?.hand_size ?? 0)))
    setMulliganOpen(cardsInZone(opening, "hand").length > 0)
    setTopRevealed(false)
    // effectsRef is a stable mutable bag; omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resourceByColor identity tracked via resourcesReady+deck
  }, [status, deck, resourcesReady, resourceByColor])

  const handCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.hand),
    [sessionCardsState]
  )
  const battlefieldCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.battlefield),
    [sessionCardsState]
  )
  const stockpileCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.stockpile),
    [sessionCardsState]
  )
  const pilotCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.pilot),
    [sessionCardsState]
  )
  const libraryCount = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.library).length,
    [sessionCardsState]
  )
  const trashCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.trashyard),
    [sessionCardsState]
  )
  const dismantledCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.dismantled),
    [sessionCardsState]
  )
  const topLibraryCard = useMemo(
    () =>
      topRevealed
        ? (peekTopLibrary(sessionCardsState, 1)[0] ?? null)
        : null,
    [sessionCardsState, topRevealed]
  )

  function moveCards(moves: { instanceId: string; x: number; y: number }[]) {
    if (moves.length === 0) return
    const byId = new Map(moves.map((m) => [m.instanceId, m]))
    setSessionCards((prev) =>
      prev.map((card) => {
        const move = byId.get(card.instanceId)
        return move ? { ...card, x: move.x, y: move.y } : card
      })
    )
  }

  function bringToFront(instanceId: string) {
    setSessionCards((prev) => moveCardtoFront(prev, instanceId))
  }

  function sendToBack(instanceId: string) {
    setSessionCards((prev) => moveCardtoBack(prev, instanceId))
  }

  function toggleExpendedIds(instanceIds: string[]) {
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        next = toggleExpended(next, id)
      }
      return next
    })
  }

  function changeFloatSelection(
    zone: "battlefield" | "stockpile",
    instanceIds: string[]
  ) {
    const selected = new Set(instanceIds)
    setSessionCards((prev) =>
      prev.map((card) => {
        if (card.zone !== zone) {
          return card.selected ? { ...card, selected: false } : card
        }
        const nextSelected = selected.has(card.instanceId)
        return card.selected === nextSelected
          ? card
          : { ...card, selected: nextSelected }
      })
    )
  }

  function changeHandSelection(instanceIds: string[]) {
    const selected = new Set(instanceIds)
    setSessionCards((prev) =>
      prev.map((card) => {
        if (card.zone === PLAY_ZONE.hand) {
          const nextSelected = selected.has(card.instanceId)
          return card.selected === nextSelected
            ? card
            : { ...card, selected: nextSelected }
        }
        if (
          (card.zone === "battlefield" || card.zone === "stockpile") &&
          card.selected
        ) {
          return { ...card, selected: false }
        }
        return card
      })
    )
  }

  function commitWithStockpileTimeCompletions(
    before: PlayingCardInstance[],
    after: PlayingCardInstance[]
  ) {
    const { cards, launching } = extractStockpileTimeCompletions(before, after)
    commitCards(cards)
    effectsRef.current.queueStockpileTimeCompletions?.(launching)
  }

  function startTurn(blocked: boolean) {
    if (blocked) return
    const before = sessionCardsRef.current
    commitWithStockpileTimeCompletions(
      before,
      readyBattlefieldAndStockpile(before)
    )
  }

  function endTurn(blocked: boolean) {
    if (blocked) return
    const targetHand = Math.max(0, pilotHandSize - 2)
    const handCount = cardsInZone(sessionCardsRef.current, PLAY_ZONE.hand).length
    const need = Math.max(0, targetHand - handCount)

    if (need > 0) {
      const libCount = cardsInZone(
        sessionCardsRef.current,
        PLAY_ZONE.library
      ).length
      const drawCount = Math.min(need, libCount)
      const lifeLoss = need - drawCount
      if (lifeLoss > 0) {
        setLife((prev) => Math.max(0, prev - lifeLoss))
      }
      if (drawCount > 0) {
        effectsRef.current.queueDrawsToHand?.(drawCount)
      }
    }

    setTurn((prev) => prev + 1)
  }

  function deleteCards(instanceIds: string[]) {
    if (instanceIds.length === 0) return
    const ids = new Set(instanceIds)
    setSessionCards((prev) => prev.filter((c) => !ids.has(c.instanceId)))
  }

  function adjustCounters(
    instanceIds: string[],
    kind: CardCounterKind,
    delta: number
  ) {
    if (instanceIds.length === 0) return
    const before = sessionCardsRef.current
    const after = instanceIds.reduce(
      (cards, id) => adjustCardCounter(cards, id, kind, delta),
      before
    )
    if (kind === "time") {
      commitWithStockpileTimeCompletions(before, after)
      return
    }
    commitCards(after)
  }

  function spawnResourceColor(
    color: ResourceColor,
    onMissing?: () => void
  ): boolean {
    const template = resourceByColor.get(color)
    if (!template) {
      onMissing?.()
      return false
    }
    setSessionCards((prev) => {
      const seq = cardsInZone(prev, PLAY_ZONE.stockpile).length
      return [
        ...prev,
        spawnResourceTokenInstance(
          template,
          20 + (seq % 8) * 28,
          24 + Math.floor(seq / 8) * 16,
          seq
        ),
      ]
    })
    return true
  }

  function adjustPilotGenBonus(delta: number) {
    setPilotGenBonus((prev) =>
      Math.max(0, Math.min(PILOT_GEN_MAX, prev + delta))
    )
  }

  function putOnLibraryBottom(instanceIds: string[]) {
    setSessionCards((prev) => putCardsOnLibraryBottom(prev, instanceIds))
  }

  function setFaceDown(instanceIds: string[], faceDown: boolean) {
    setSessionCards((prev) => setCardsFaceDown(prev, instanceIds, faceDown))
  }

  function duplicateCards(instanceIds: string[]) {
    setSessionCards((prev) => duplicatePlayingCards(prev, instanceIds))
  }

  function moveAll(from: MoveAllSourceZone, to: MoveAllDestinationZone) {
    setSessionCards((prev) => moveAllFromZone(prev, from, to))
  }

  function putDeckTopOnBottom(count: number) {
    setSessionCards((prev) => putTopLibraryOnBottom(prev, count))
  }

  function shuffleLibraryCards() {
    setSessionCards((prev) => shuffleLibrary(prev))
  }

  function reorderTop(orderedIds: string[]) {
    setSessionCards((prev) => reorderTopLibrary(prev, orderedIds))
  }

  function confirmMulligan(selectedIds: string[]) {
    const result = applyMulliganToBottom(
      sessionCardsRef.current,
      selectedIds
    )
    commitCards(result.cards)
    setMulliganOpen(false)
    if (result.drawCount > 0) {
      effectsRef.current.queueDrawsToHand?.(result.drawCount)
    }
  }

  function finishAccumulateSpawn(
    card: PlayingCardInstance,
    colors: ResourceColor[]
  ) {
    setSessionCards((prev) => {
      let next = prev.filter((c) => c.instanceId !== card.instanceId)
      colors.forEach((color, index) => {
        const template = resourceByColor.get(color)
        if (!template) return
        next = [
          ...next,
          spawnResourceTokenInstance(
            template,
            20 + index * 28,
            24 + index * 12,
            index
          ),
        ]
      })
      return next
    })
  }

  return {
    sessionCards: sessionCardsState,
    setSessionCards,
    sessionCardsRef,
    commitCards,
    life,
    setLife,
    turn,
    pilotGenBonus,
    pilotHandSize,
    mulliganOpen,
    setMulliganOpen,
    topRevealed,
    setTopRevealed,
    handCards,
    battlefieldCards,
    stockpileCards,
    pilotCards,
    libraryCount,
    topLibraryCard,
    trashCards,
    dismantledCards,
    moveCards,
    bringToFront,
    sendToBack,
    toggleExpendedIds,
    changeFloatSelection,
    changeHandSelection,
    startTurn,
    endTurn,
    deleteCards,
    adjustCounters,
    spawnResourceColor,
    adjustPilotGenBonus,
    putOnLibraryBottom,
    setFaceDown,
    duplicateCards,
    moveAll,
    putDeckTopOnBottom,
    shuffleLibraryCards,
    reorderTop,
    confirmMulligan,
    finishAccumulateSpawn,
  }
}
