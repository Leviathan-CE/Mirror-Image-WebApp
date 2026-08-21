/**
 * Playtester session core: card bag + turn/life/pilot.
 * Table mutations go through `dispatch` → `applyAction`. Selection stays local.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"

import type { ResourceColor } from "@/components/Playtester/accumulateResources.logic"
import {
  viewToWorld,
} from "@/components/Playtester/augmentRow.logic"
import { peekTopLibrary } from "@/components/Playtester/deckActions.logic"
import { PLAY_FLOAT_LOGICAL } from "@/components/Playtester/playFieldScale.logic"
import {
  LOCAL_SEAT,
  OPENING_MULLIGAN_ENABLED,
  PLAY_ZONE,
  otherSeat,
  type PlayerSlot,
} from "@/components/Playtester/playtesterConstants"
import {
  setupOpeningSession,
  startingLifeFromPilot,
} from "@/components/Playtester/setupOpeningSession.logic"
import {
  applyAction,
  cardsInZone,
  createPlaySessionState,
  materializeFog,
  seatRecord,
  type CardCounterKind,
  type FogView,
  type MoveAllDestinationZone,
  type MoveAllSourceZone,
  type PlaySessionState,
  type PlayingCardInstance,
  type SessionAction,
} from "@/components/Playtester/types"
import { pilotCard } from "@/components/decks/deck.logic"
import type { CardLibraryItem } from "@/lib/api/cards"
import type { DeckDetail } from "@/lib/api/decks"
import type { DeckLoadStatus } from "@/hooks/useDeckDetail"

/** Animation / timer side-effects the page wires after `useDrawAnimations`. */
export type PlaySessionEffects = {
  clearDrawTimers: () => void
  queueStockpileTimeCompletions: (launching: PlayingCardInstance[]) => void
  queueDrawsToHand: (count: number) => void
}

export type PlayNetRole = "local" | "host" | "guest"

export type UsePlaySessionArgs = {
  status: DeckLoadStatus
  deck: DeckDetail | null
  opponentDeck?: DeckDetail | null
  resourceByColor: Map<ResourceColor, CardLibraryItem>
  resourcesReady: boolean
  effectsRef: MutableRefObject<Partial<PlaySessionEffects>>
  /**
   * Seat rendered at the bottom of the table. Hotseat flips this to look from
   * the other side; it never changes who owns which cards.
   */
  localSeat?: PlayerSlot
  /**
   * Seat `deck` is dealt to — the seat this client actually holds. Kept apart
   * from `localSeat` so swapping the view never re-deals the table.
   */
  mySeat?: PlayerSlot
  /** local = solo/hotseat; host applies; guest sends intents and hydrates fog. */
  netRole?: PlayNetRole
  /** Host: true once the other socket is in the room (even before their deck loads). */
  peerPresent?: boolean
  sendIntent?: (action: SessionAction) => void
  onHostCommit?: (action: SessionAction | null, state: PlaySessionState) => void
}

export function usePlaySession({
  status,
  deck,
  opponentDeck = null,
  resourceByColor,
  resourcesReady,
  effectsRef,
  localSeat = LOCAL_SEAT,
  mySeat = LOCAL_SEAT,
  netRole = "local",
  peerPresent = false,
  sendIntent,
  onHostCommit,
}: UsePlaySessionArgs) {
  const [sessionCardsState, setSessionCardsState] = useState<
    PlayingCardInstance[]
  >([])
  const sessionCardsRef = useRef<PlayingCardInstance[]>([])
  sessionCardsRef.current = sessionCardsState

  const [lifeBySeat, setLifeBySeat] = useState(seatRecord(0))
  const [turn, setTurn] = useState(1)
  const [turnSeat, setTurnSeat] = useState<PlayerSlot>(LOCAL_SEAT)
  const [pilotGenBySeat, setPilotGenBySeat] = useState(seatRecord(0))
  const [pilotHandBySeat, setPilotHandBySeat] = useState(seatRecord(0))
  const [mulliganOpen, setMulliganOpen] = useState(false)
  const [topRevealed, setTopRevealed] = useState(false)
  const rngRef = useRef(1)
  const nextIdRef = useRef(1)
  const seqRef = useRef(0)
  const fogCountsRef = useRef<{
    hand: { p1: number; p2: number }
    library: { p1: number; p2: number }
  } | null>(null)
  const [fogCounts, setFogCounts] = useState<{
    hand: { p1: number; p2: number }
    library: { p1: number; p2: number }
  } | null>(null)
  const guestMulliganArmed = useRef(false)
  const guestPlaceholderDealt = useRef(false)
  const netRoleRef = useRef(netRole)
  netRoleRef.current = netRole
  const sendIntentRef = useRef(sendIntent)
  sendIntentRef.current = sendIntent
  const onHostCommitRef = useRef(onHostCommit)
  onHostCommitRef.current = onHostCommit
  const lifeRef = useRef(lifeBySeat)
  lifeRef.current = lifeBySeat
  const turnRef = useRef(turn)
  turnRef.current = turn
  const turnSeatRef = useRef(turnSeat)
  turnSeatRef.current = turnSeat
  const pilotGenRef = useRef(pilotGenBySeat)
  pilotGenRef.current = pilotGenBySeat

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

  const snapshot = useCallback(
    () =>
      createPlaySessionState({
        cards: sessionCardsRef.current,
        life: lifeRef.current,
        turn: turnRef.current,
        turnSeat: turnSeatRef.current,
        pilotGenBonus: pilotGenRef.current,
        rng: rngRef.current,
        nextId: nextIdRef.current,
        seq: seqRef.current,
      }),
    []
  )

  const dispatch = useCallback(
    (action: SessionAction) => {
      if (netRoleRef.current === "guest") {
        sendIntentRef.current?.(action)
        return snapshot()
      }
      const next = applyAction(snapshot(), action)
      rngRef.current = next.rng
      nextIdRef.current = next.nextId
      seqRef.current = next.seq
      commitCards(next.cards)
      setLifeBySeat(next.life)
      setTurn(next.turn)
      setTurnSeat(next.turnSeat)
      setPilotGenBySeat(next.pilotGenBonus)
      onHostCommitRef.current?.(action, next)
      return next
    },
    [snapshot]
  )

  const applyFog = useCallback((view: FogView) => {
    const nextCards = materializeFog(view)
    const viewerHasCards = nextCards.some((c) => c.owner === view.viewer)
    const viewerCounts =
      (view.handCount[view.viewer] ?? 0) + (view.libraryCount[view.viewer] ?? 0)
    if (!viewerHasCards && viewerCounts === 0 && view.seq === 0) {
      return
    }
    seqRef.current = view.seq
    commitCards(nextCards)
    setLifeBySeat(view.life)
    setTurn(view.turn)
    setTurnSeat(view.turnSeat)
    setPilotGenBySeat(view.pilotGenBonus ?? { p1: 0, p2: 0 })
    const counts = { hand: view.handCount, library: view.libraryCount }
    fogCountsRef.current = counts
    setFogCounts(counts)
    if (OPENING_MULLIGAN_ENABLED && view.seq === 0) {
      guestMulliganArmed.current = false
    }
    if (
      OPENING_MULLIGAN_ENABLED &&
      !guestMulliganArmed.current &&
      cardsInZone(nextCards, PLAY_ZONE.hand, view.viewer).length > 0
    ) {
      guestMulliganArmed.current = true
      setMulliganOpen(true)
    }
  }, [])

  // Opponent row only when a second deck exists, or this client is the guest
  // waiting on / rendering a fog view. Creating a room must not flip the
  // local table — host keeps the solo layout until someone joins.
  const twoSeat =
    Boolean(opponentDeck) ||
    netRole === "guest" ||
    (netRole === "host" && peerPresent)

  useEffect(() => {
    if (status !== "ready" || !deck) {
      commitCards([])
      setLifeBySeat(seatRecord(0))
      setTurn(1)
      setTurnSeat(LOCAL_SEAT)
      setPilotGenBySeat(seatRecord(0))
      setPilotHandBySeat(seatRecord(0))
      setMulliganOpen(false)
      setTopRevealed(false)
      effectsRef.current.clearDrawTimers?.()
      return
    }
    if (netRole === "guest") {
      if (!fogCountsRef.current && !guestPlaceholderDealt.current) {
        guestPlaceholderDealt.current = true
        const mine = setupOpeningSession(deck, resourceByColor, mySeat)
        const pilot = pilotCard(deck.cards, deck.categories)
        commitCards(mine)
        setLifeBySeat((prev) => ({
          ...prev,
          [mySeat]: startingLifeFromPilot(pilot),
        }))
        setPilotHandBySeat((prev) => ({
          ...prev,
          [mySeat]: Math.max(0, Math.floor(pilot?.hand_size ?? 0)),
        }))
        setTurnSeat(mySeat)
        if (OPENING_MULLIGAN_ENABLED) {
          setMulliganOpen(cardsInZone(mine, "hand", mySeat).length > 0)
        }
      }
      return
    }
    guestPlaceholderDealt.current = false
    if (!resourcesReady) return
    // Host waiting for a guest: keep the current solo deal at the bottom.
    // Re-deal both seats only once the opponent deck is actually loaded.
    if ((twoSeat || netRole === "host") && !opponentDeck) return

    const theirSeat = otherSeat(mySeat)
    const mine = setupOpeningSession(deck, resourceByColor, mySeat)
    const theirs = opponentDeck
      ? setupOpeningSession(opponentDeck, resourceByColor, theirSeat)
      : []
    const opening = [...mine, ...theirs]
    const pilot = pilotCard(deck.cards, deck.categories)
    const oppPilot = opponentDeck
      ? pilotCard(opponentDeck.cards, opponentDeck.categories)
      : null
    rngRef.current = (Date.now() ^ deck.id ^ (opponentDeck?.id ?? 0)) >>> 0
    nextIdRef.current = 1
    seqRef.current = 0
    commitCards(opening)
    const life = seatRecord(0)
    life[mySeat] = startingLifeFromPilot(pilot)
    life[theirSeat] = startingLifeFromPilot(oppPilot)
    const handSizes = seatRecord(0)
    handSizes[mySeat] = Math.max(0, Math.floor(pilot?.hand_size ?? 0))
    handSizes[theirSeat] = Math.max(0, Math.floor(oppPilot?.hand_size ?? 0))
    setLifeBySeat(life)
    setTurn(1)
    setTurnSeat(mySeat)
    setPilotGenBySeat(seatRecord(0))
    setPilotHandBySeat(handSizes)
    if (OPENING_MULLIGAN_ENABLED) {
      setMulliganOpen(cardsInZone(opening, "hand", mySeat).length > 0)
    }
    setTopRevealed(false)
    if (netRole === "host") {
      onHostCommitRef.current?.(
        null,
        createPlaySessionState({
          cards: opening,
          life,
          turn: 1,
          turnSeat: mySeat,
          rng: rngRef.current,
          nextId: nextIdRef.current,
          seq: seqRef.current,
        })
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resourceByColor identity tracked via resourcesReady+deck
  }, [status, deck, opponentDeck, resourcesReady, resourceByColor, twoSeat, mySeat, netRole])

  const oppSeat = otherSeat(localSeat)

  const handCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.hand, localSeat),
    [sessionCardsState, localSeat]
  )
  const oppHandCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.hand, oppSeat),
    [sessionCardsState, oppSeat]
  )
  const battlefieldCards = useMemo(
    () => sessionCardsState.filter((c) => c.zone === PLAY_ZONE.battlefield),
    [sessionCardsState]
  )
  const localStockpileCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.stockpile, localSeat),
    [sessionCardsState, localSeat]
  )
  const oppStockpileCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.stockpile, oppSeat),
    [sessionCardsState, oppSeat]
  )
  const pilotCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.pilot, localSeat),
    [sessionCardsState, localSeat]
  )
  const oppPilotCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.pilot, oppSeat),
    [sessionCardsState, oppSeat]
  )
  const libraryCount = useMemo(
    () =>
      fogCounts
        ? fogCounts.library[localSeat]
        : cardsInZone(sessionCardsState, PLAY_ZONE.library, localSeat).length,
    [sessionCardsState, localSeat, fogCounts]
  )
  const oppLibraryCount = useMemo(
    () =>
      fogCounts
        ? fogCounts.library[oppSeat]
        : cardsInZone(sessionCardsState, PLAY_ZONE.library, oppSeat).length,
    [sessionCardsState, oppSeat, fogCounts]
  )
  const trashCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.trashyard, localSeat),
    [sessionCardsState, localSeat]
  )
  const oppTrashCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.trashyard, oppSeat),
    [sessionCardsState, oppSeat]
  )
  const dismantledCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.dismantled, localSeat),
    [sessionCardsState, localSeat]
  )
  const oppDismantledCards = useMemo(
    () => cardsInZone(sessionCardsState, PLAY_ZONE.dismantled, oppSeat),
    [sessionCardsState, oppSeat]
  )
  const topLibraryCard = useMemo(
    () =>
      topRevealed
        ? (peekTopLibrary(sessionCardsState, 1, localSeat)[0] ?? null)
        : null,
    [sessionCardsState, topRevealed, localSeat]
  )

  const life = lifeBySeat[localSeat]
  const oppLife = lifeBySeat[oppSeat]
  const pilotGenBonus = pilotGenBySeat[localSeat]
  const oppPilotGenBonus = pilotGenBySeat[oppSeat]
  const pilotHandSize = pilotHandBySeat[localSeat]

  function moveCards(moves: { instanceId: string; x: number; y: number }[]) {
    if (moves.length === 0) return
    dispatch({
      t: "ps",
      i: moves.map((m) => {
        const world = viewToWorld(m.x, m.y, localSeat, PLAY_FLOAT_LOGICAL)
        return { id: m.instanceId, x: world.x, y: world.y }
      }),
    })
  }

  function bringToFront(instanceId: string) {
    dispatch({ t: "fr", i: instanceId })
  }

  function sendToBack(instanceId: string) {
    dispatch({ t: "bk", i: instanceId })
  }

  function toggleExpendedIds(instanceIds: string[]) {
    if (instanceIds.length === 0) return
    dispatch({ t: "xp", i: instanceIds })
  }

  function changeFloatSelection(instanceIds: string[]) {
    const selected = new Set(instanceIds)
    setSessionCards((prev) =>
      prev.map((card) => {
        if (
          card.zone !== PLAY_ZONE.battlefield &&
          card.zone !== PLAY_ZONE.stockpile
        ) {
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
        if (card.zone === PLAY_ZONE.hand && card.owner === localSeat) {
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

  function startTurn(blocked: boolean) {
    if (blocked) return
    const before = sessionCardsRef.current
    const after = dispatch({ t: "rdy", seat: localSeat })
    const launching = after.cards.filter((c) => {
      const prev = before.find((b) => b.instanceId === c.instanceId)
      return (
        prev?.zone === PLAY_ZONE.stockpile &&
        c.zone === PLAY_ZONE.battlefield
      )
    })
    effectsRef.current.queueStockpileTimeCompletions?.(launching)
  }

  function endTurn(blocked: boolean) {
    if (blocked) return
    const targetHand = Math.max(0, pilotHandSize - 2)
    const handCount = cardsInZone(
      sessionCardsRef.current,
      PLAY_ZONE.hand,
      localSeat
    ).length
    const need = Math.max(0, targetHand - handCount)

    if (need > 0) {
      const libCount = cardsInZone(
        sessionCardsRef.current,
        PLAY_ZONE.library,
        localSeat
      ).length
      const drawCount = Math.min(need, libCount)
      const lifeLoss = need - drawCount
      if (lifeLoss > 0) {
        dispatch({ t: "lf", seat: localSeat, d: -lifeLoss })
      }
      if (drawCount > 0) {
        effectsRef.current.queueDrawsToHand?.(drawCount)
      }
    }

    dispatch({ t: "ts", seat: oppSeat })
  }

  function deleteCards(instanceIds: string[]) {
    if (instanceIds.length === 0) return
    dispatch({ t: "rm", i: instanceIds })
  }

  function adjustCounters(
    instanceIds: string[],
    kind: CardCounterKind,
    delta: number
  ) {
    if (instanceIds.length === 0) return
    const before = sessionCardsRef.current
    const after = dispatch({ t: "ct", i: instanceIds, k: kind, d: delta })
    if (kind !== "time") return
    const launching = after.cards.filter((c) => {
      const prev = before.find((b) => b.instanceId === c.instanceId)
      return (
        prev?.zone === PLAY_ZONE.stockpile &&
        c.zone === PLAY_ZONE.battlefield
      )
    })
    effectsRef.current.queueStockpileTimeCompletions?.(launching)
  }

  function spawnResourceColor(
    color: ResourceColor,
    onMissing?: () => void,
    at?: { x: number; y: number }
  ): boolean {
    const template = resourceByColor.get(color)
    if (!template) {
      onMissing?.()
      return false
    }
    const world = at
      ? viewToWorld(at.x, at.y, localSeat, PLAY_FLOAT_LOGICAL)
      : undefined
    dispatch({
      t: "tk",
      seat: localSeat,
      cardId: template.id,
      name: template.card_name,
      artPath: template.card_art_path,
      artVersion: template.card_art_version ?? null,
      cost: Array.isArray(template.cost) ? template.cost.map(String) : [],
      x: world?.x,
      y: world?.y,
    })
    return true
  }

  function adjustPilotGenBonus(delta: number) {
    dispatch({ t: "pg", seat: localSeat, d: delta })
  }

  function putOnLibraryBottom(instanceIds: string[]) {
    dispatch({ t: "lb", i: instanceIds })
  }

  function setFaceDown(instanceIds: string[], faceDown: boolean) {
    dispatch({ t: "fd", i: instanceIds, down: faceDown })
  }

  function duplicateCards(instanceIds: string[]) {
    dispatch({ t: "cp", i: instanceIds })
  }

  function moveAll(from: MoveAllSourceZone, to: MoveAllDestinationZone) {
    dispatch({ t: "ma", seat: localSeat, from, to })
  }

  function putDeckTopOnBottom(count: number) {
    dispatch({ t: "tb", seat: localSeat, n: count })
  }

  function shuffleLibraryCards() {
    dispatch({ t: "sh", seat: localSeat })
  }

  function reorderTop(orderedIds: string[]) {
    dispatch({ t: "ro", seat: localSeat, i: orderedIds })
  }

  function confirmMulligan(selectedIds: string[]) {
    if (selectedIds.length > 0) {
      dispatch({ t: "lb", i: selectedIds })
    }
    setMulliganOpen(false)
    if (selectedIds.length > 0) {
      effectsRef.current.queueDrawsToHand?.(selectedIds.length)
    }
  }

  function finishAccumulateSpawn(
    card: PlayingCardInstance,
    colors: ResourceColor[],
    homes: Array<{ x: number; y: number }> = []
  ) {
    dispatch({ t: "lb", i: [card.instanceId] })
    colors.forEach((color, index) => {
      const template = resourceByColor.get(color)
      if (!template) return
      const at = homes[index]
      const world = at
        ? viewToWorld(at.x, at.y, localSeat, PLAY_FLOAT_LOGICAL)
        : undefined
      dispatch({
        t: "tk",
        seat: localSeat,
        cardId: template.id,
        name: template.card_name,
        artPath: template.card_art_path,
        artVersion: template.card_art_version ?? null,
        cost: Array.isArray(template.cost) ? template.cost.map(String) : [],
        x: world?.x,
        y: world?.y,
      })
    })
  }

  function setLifeForLocal(next: number | ((prev: number) => number)) {
    const current = lifeRef.current[localSeat]
    const value = typeof next === "function" ? next(current) : next
    dispatch({ t: "lf", seat: localSeat, d: value - current })
  }

  return {
    sessionCards: sessionCardsState,
    setSessionCards,
    sessionCardsRef,
    commitCards,
    dispatch,
    applyFog,
    snapshot,
    localSeat,
    oppSeat,
    twoSeat,
    life,
    oppLife,
    setLife: setLifeForLocal,
    lifeBySeat,
    turn,
    turnSeat,
    pilotGenBonus,
    oppPilotGenBonus,
    pilotHandSize,
    mulliganOpen,
    setMulliganOpen,
    topRevealed,
    setTopRevealed,
    handCards,
    oppHandCards,
    battlefieldCards,
    localStockpileCards,
    oppStockpileCards,
    pilotCards,
    oppPilotCards,
    libraryCount,
    oppLibraryCount,
    topLibraryCard,
    trashCards,
    oppTrashCards,
    dismantledCards,
    oppDismantledCards,
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
