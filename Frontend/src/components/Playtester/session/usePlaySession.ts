/**
 * Table mutations go through `dispatch` → `applyAction`.
 * Public-zone click-highlight is mirrored over the `selection` net message;
 * hand/library selection stays on this client.
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

import type { ResourceColor } from "@/components/Playtester/session/accumulateResources.logic"
import { useLatestRef } from "@/hooks/useLatestRef"
import {
  displayToWorld,
  stampStockpileWorldHomes,
} from "@/components/Playtester/board/augmentRow.logic"
import { peekTopLibrary } from "@/components/Playtester/search/deckActions.logic"
import { PLAY_FLOAT_LOGICAL } from "@/components/Playtester/board/playFieldScale.logic"
import type { ParentSize } from "@/components/Playtester/board/handFloatPanel.logic"
import {
  LOCAL_SEAT,
  OPENING_MULLIGAN_ENABLED,
  PLAY_ZONE,
  otherSeat,
  type PlayerSlot,
} from "@/components/Playtester/constants"
import {
  setupOpeningSession,
  startingLifeFromPilot,
  victoryNumberFromPilot,
  guestMayPlaceholderDeal,
  guestPlaceholderCoverageImproved,
  hostOpeningMayCommit,
  mergeOpeningStockpilePips,
  openingTimCoverage,
  startingResourceColorsFromPilot,
  missingStartingResourceColors,
  spawnGroupedStockpileResources,
} from "@/components/Playtester/session/setupOpeningSession.logic"
import {
  applyAction,
  cardsInZone,
  createPlaySessionState,
  materializeFog,
  withPreservedSelection,
  applySharedSelection,
  sharedSelectionIds,
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
  /** Fire after a local click-highlight so the peer can paint the same rings. */
  shareSelection?: (ids: string[]) => void
  /** Painted float size — coords from drag/spawn convert through this ref. */
  displayFieldRef?: MutableRefObject<ParentSize>
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
  shareSelection,
  displayFieldRef: displayFieldRefArg,
}: UsePlaySessionArgs) {
  const fallbackDisplayRef = useRef<ParentSize>(PLAY_FLOAT_LOGICAL)
  const displayFieldRef = displayFieldRefArg ?? fallbackDisplayRef
  const [sessionCardsState, setSessionCardsState] = useState<
    PlayingCardInstance[]
  >([])
  const sessionCardsRef = useLatestRef(sessionCardsState)

  const [lifeBySeat, setLifeBySeat] = useState(seatRecord(0))
  const [vpBySeat, setVpBySeat] = useState(seatRecord(0))
  const [vpGoalBySeat, setVpGoalBySeat] = useState(seatRecord(0))
  const [turn, setTurn] = useState(1)
  const [turnSeat, setTurnSeat] = useState<PlayerSlot>(LOCAL_SEAT)
  const [pilotGenBySeat, setPilotGenBySeat] = useState(seatRecord(0))
  const [pilotHandBySeat, setPilotHandBySeat] = useState(seatRecord(0))
  const [mulliganOpen, setMulliganOpen] = useState(false)
  /** Per-seat public deck-top reveal — shared session state, not local UI. */
  const [topRevealedBySeat, setTopRevealedBySeat] = useState(seatRecord(false))
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
  const guestOpeningTkIds = useRef(new Set<string>())
  const netRoleRef = useLatestRef(netRole)
  const sendIntentRef = useLatestRef(sendIntent)
  const onHostCommitRef = useLatestRef(onHostCommit)
  const shareSelectionRef = useLatestRef(shareSelection)
  const lifeRef = useLatestRef(lifeBySeat)
  const vpRef = useLatestRef(vpBySeat)
  const vpGoalRef = useLatestRef(vpGoalBySeat)
  const turnRef = useLatestRef(turn)
  const turnSeatRef = useLatestRef(turnSeat)
  const pilotGenRef = useLatestRef(pilotGenBySeat)
  const topRevealedRef = useLatestRef(topRevealedBySeat)

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
        vp: vpRef.current,
        vpGoal: vpGoalRef.current,
        turn: turnRef.current,
        turnSeat: turnSeatRef.current,
        pilotGenBonus: pilotGenRef.current,
        rng: rngRef.current,
        nextId: nextIdRef.current,
        seq: seqRef.current,
        topRevealedBySeat: topRevealedRef.current,
      }),
    []
  )

  const dispatch = useCallback(
    (action: SessionAction) => {
      if (netRoleRef.current === "guest") {
        // Selection is local-only — never send as intent / never wait for fog.
        if (action.t === "sel") {
          const next = applyAction(snapshot(), action)
          commitCards(next.cards)
          return snapshot()
        }
        sendIntentRef.current?.(action)
        // Keep local seq behind host — fog will set seq. Optimistic so
        // release / expend don't wait on RTT (snap-back / missed spin).
        if (action.t === "ps" || action.t === "xp" || action.t === "rdy") {
          const next = applyAction(snapshot(), action)
          commitCards(next.cards)
        }
        // Reveal toggles a scalar, not `cards` — same instant-feedback intent
        // as above, just committed to the scalar it actually changes.
        if (action.t === "rv") {
          const next = applyAction(snapshot(), action)
          setTopRevealedBySeat(next.topRevealedBySeat)
        }
        if (action.t === "vp") {
          const next = applyAction(snapshot(), action)
          setVpBySeat(next.vp)
        }
        return snapshot()
      }
      const next = applyAction(snapshot(), action)
      rngRef.current = next.rng
      nextIdRef.current = next.nextId
      seqRef.current = next.seq
      commitCards(next.cards)
      setLifeBySeat(next.life)
      setVpBySeat(next.vp)
      setVpGoalBySeat(next.vpGoal)
      setTurn(next.turn)
      setTurnSeat(next.turnSeat)
      setPilotGenBySeat(next.pilotGenBonus)
      setTopRevealedBySeat(next.topRevealedBySeat)
      onHostCommitRef.current?.(action, next)
      return next
    },
    [snapshot]
  )

  const applyFog = useCallback((view: FogView) => {
    // Drop stale fog so an older select cannot repaint rings after a deselect.
    if (view.seq < seqRef.current) return

    let nextCards = materializeFog(view)
    const viewerHasCards = nextCards.some((c) => c.owner === view.viewer)
    const viewerCounts =
      (view.handCount[view.viewer] ?? 0) + (view.libraryCount[view.viewer] ?? 0)

    // DEBUG: Log fog reception for TIM diagnosis
    const viewerStockpile = nextCards.filter(
      (c) => c.owner === view.viewer && c.zone === PLAY_ZONE.stockpile
    )
    const viewerTIM = viewerStockpile.filter((c) =>
      c.cost?.some((pip) => pip === "TIM")
    )
    console.info("[applyFog] received fog", {
      viewer: view.viewer,
      seq: view.seq,
      localSeq: seqRef.current,
      viewerHasCards,
      viewerCounts,
      viewerStockpileCount: viewerStockpile.length,
      viewerTIMCount: viewerTIM.length,
      totalCards: nextCards.length,
    })

    if (!viewerHasCards && viewerCounts === 0 && view.seq === 0) {
      return
    }

    const incomingIds = new Set(nextCards.map((card) => card.instanceId))
    nextCards = mergeOpeningStockpilePips({
      seq: view.seq,
      owner: view.viewer,
      incoming: nextCards,
      previous: sessionCardsRef.current,
    })
    for (const card of nextCards) {
      if (incomingIds.has(card.instanceId)) continue
      if (card.zone !== PLAY_ZONE.stockpile) continue
      if (guestOpeningTkIds.current.has(card.instanceId)) continue
      guestOpeningTkIds.current.add(card.instanceId)
      dispatch({
        t: "tk",
        seat: card.owner,
        cardId: card.cardId,
        name: card.name,
        artPath: card.artPath,
        artVersion: card.artVersion ?? null,
        cost: card.cost,
        x: card.x,
        y: card.y,
      })
    }

    const keepLocal = new Set(
      sessionCardsRef.current
        .filter((card) => card.selected)
        .map((card) => card.instanceId)
    )
    // Selection is local-only — never copy peer `selected` onto the action bag.
    nextCards = nextCards.map((card) =>
      card.owner === view.viewer || !card.selected
        ? card
        : { ...card, selected: false }
    )
    seqRef.current = view.seq
    commitCards(withPreservedSelection(nextCards, keepLocal, view.viewer))
    setLifeBySeat(view.life)
    setVpBySeat(view.vp ?? seatRecord(0))
    setVpGoalBySeat(view.vpGoal ?? seatRecord(0))
    setTurn(view.turn)
    setTurnSeat(view.turnSeat)
    setPilotGenBySeat(view.pilotGenBonus ?? { p1: 0, p2: 0 })
    setTopRevealedBySeat(view.topRevealedBySeat ?? seatRecord(false))
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
  }, [dispatch])

  // Opponent row only when a second deck exists, or this client is the guest
  // waiting on / rendering a fog view. Creating a room must not flip the
  // local table — host keeps the solo layout until someone joins.
  const twoSeat =
    Boolean(opponentDeck) ||
    netRole === "guest" ||
    (netRole === "host" && peerPresent)

  // Leave / role change must drop stale fog bookkeeping so a rejoin can
  // placeholder-deal and accept seq-0 opening fog from the new host.
  // seqRef must reset here too — not just inside the deal effect below —
  // or a leftover seq from the previous room can outrun deck-fetch timing
  // and silently reject the new host's very first fog (view.seq < seqRef).
  useEffect(() => {
    if (netRole === "guest") return
    fogCountsRef.current = null
    setFogCounts(null)
    guestPlaceholderDealt.current = false
    guestMulliganArmed.current = false
    guestOpeningTkIds.current.clear()
    seqRef.current = 0
    nextIdRef.current = 1
    setTopRevealedBySeat(seatRecord(false))
  }, [netRole])

  useEffect(() => {
    if (status !== "ready" || !deck) {
      commitCards([])
      setLifeBySeat(seatRecord(0))
      setVpBySeat(seatRecord(0))
      setVpGoalBySeat(seatRecord(0))
      setTurn(1)
      setTurnSeat(LOCAL_SEAT)
      setPilotGenBySeat(seatRecord(0))
      setPilotHandBySeat(seatRecord(0))
      setMulliganOpen(false)
      setTopRevealedBySeat(seatRecord(false))
      fogCountsRef.current = null
      setFogCounts(null)
      guestPlaceholderDealt.current = false
      guestOpeningTkIds.current.clear()
      effectsRef.current.clearDrawTimers?.()
      return
    }
    if (netRole === "guest") {
      const guestPilot = pilotCard(deck.cards, deck.categories)
      const guestNeeded = startingResourceColorsFromPilot(guestPilot)
      const coverageImproved = guestPlaceholderCoverageImproved({
        needed: guestNeeded,
        resourceByColor,
        stockpile: sessionCardsRef.current.filter(
          (card) => card.zone === PLAY_ZONE.stockpile && card.owner === mySeat
        ),
      })
      if (
        !guestMayPlaceholderDeal({
          hasFog: Boolean(fogCountsRef.current),
          resourcesReady,
          alreadyDealt: guestPlaceholderDealt.current,
          coverageImproved,
        })
      ) {
        return
      }
      guestPlaceholderDealt.current = true
      guestOpeningTkIds.current.clear()
      const mine = setupOpeningSession(deck, resourceByColor, mySeat)
      const pilot = guestPilot
      // Always log for TIM diagnosis
      const guestStockpile = mine.filter(
        (card) => card.zone === PLAY_ZONE.stockpile && card.owner === mySeat
      )
      const guestTIM = guestStockpile.filter((c) =>
        c.cost?.some((pip) => pip === "TIM")
      )
      console.info("[guest placeholder deal]", {
        seat: mySeat,
        neededColors: guestNeeded,
        resourceMapHasTIM: resourceByColor.has("TIM"),
        resourceMapColors: [...resourceByColor.keys()],
        stockpileCount: guestStockpile.length,
        TIMCount: guestTIM.length,
        coverage: openingTimCoverage({
          requestedColors: guestNeeded,
          resourceByColor,
          stockpile: guestStockpile,
        }),
      })
      seqRef.current = 0
      nextIdRef.current = 1
      commitCards(mine)
      setLifeBySeat((prev) => ({
        ...prev,
        [mySeat]: startingLifeFromPilot(pilot),
      }))
      setVpBySeat((prev) => ({ ...prev, [mySeat]: 0 }))
      setVpGoalBySeat((prev) => ({
        ...prev,
        [mySeat]: victoryNumberFromPilot(pilot),
      }))
      setPilotHandBySeat((prev) => ({
        ...prev,
        [mySeat]: Math.max(0, Math.floor(pilot?.card.hand_size ?? 0)),
      }))
      setTurnSeat(mySeat)
      if (OPENING_MULLIGAN_ENABLED) {
        setMulliganOpen(cardsInZone(mine, "hand", mySeat).length > 0)
      }
      return
    }
    guestPlaceholderDealt.current = false
    if (
      !hostOpeningMayCommit({
        resourcesReady,
        hasOpponentDeck: Boolean(opponentDeck),
        requiresOpponentDeck: twoSeat || netRole === "host",
      })
    ) {
      return
    }

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
    // Always log for TIM diagnosis
    const hostStockpile = mine.filter(
      (card) => card.zone === PLAY_ZONE.stockpile && card.owner === mySeat
    )
    const guestStockpile = theirs.filter(
      (card) => card.zone === PLAY_ZONE.stockpile && card.owner === theirSeat
    )
    const hostTIM = hostStockpile.filter((c) =>
      c.cost?.some((pip) => pip === "TIM")
    )
    const guestTIM = guestStockpile.filter((c) =>
      c.cost?.some((pip) => pip === "TIM")
    )
    const hostNeeded = startingResourceColorsFromPilot(pilot)
    const oppNeeded = startingResourceColorsFromPilot(oppPilot)
    console.info("[host opening deal]", {
      netRole,
      mySeat,
      theirSeat,
      resourceMapHasTIM: resourceByColor.has("TIM"),
      resourceMapColors: [...resourceByColor.keys()],
      hostNeededColors: hostNeeded,
      oppNeededColors: oppNeeded,
      hostStockpileCount: hostStockpile.length,
      guestStockpileCount: guestStockpile.length,
      hostTIMCount: hostTIM.length,
      guestTIMCount: guestTIM.length,
      totalOpeningCards: opening.length,
    })
    rngRef.current = (Date.now() ^ deck.id ^ (opponentDeck?.id ?? 0)) >>> 0
    nextIdRef.current = 1
    seqRef.current = 0
    commitCards(opening)
    const life = seatRecord(0)
    life[mySeat] = startingLifeFromPilot(pilot)
    life[theirSeat] = startingLifeFromPilot(oppPilot)
    const vp = seatRecord(0)
    const vpGoal = seatRecord(0)
    vpGoal[mySeat] = victoryNumberFromPilot(pilot)
    vpGoal[theirSeat] = victoryNumberFromPilot(oppPilot)
    const handSizes = seatRecord(0)
    handSizes[mySeat] = Math.max(0, Math.floor(pilot?.card.hand_size ?? 0))
    handSizes[theirSeat] = Math.max(0, Math.floor(oppPilot?.card.hand_size ?? 0))
    setLifeBySeat(life)
    setVpBySeat(vp)
    setVpGoalBySeat(vpGoal)
    setTurn(1)
    setTurnSeat(mySeat)
    setPilotGenBySeat(seatRecord(0))
    setPilotHandBySeat(handSizes)
    if (OPENING_MULLIGAN_ENABLED) {
      setMulliganOpen(cardsInZone(opening, "hand", mySeat).length > 0)
    }
    setTopRevealedBySeat(seatRecord(false))
    if (netRole === "host") {
      onHostCommitRef.current?.(
        null,
        createPlaySessionState({
          cards: opening,
          life,
          vp,
          vpGoal,
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

  useEffect(() => {
    if (status !== "ready" || !deck || !resourcesReady) return

    const seats: Array<{ seat: PlayerSlot; source: typeof deck }> = [
      { seat: mySeat, source: deck },
    ]
    if (netRole !== "guest" && opponentDeck) {
      seats.push({ seat: otherSeat(mySeat), source: opponentDeck })
    }

    for (const { seat, source } of seats) {
      const needed = startingResourceColorsFromPilot(
        pilotCard(source.cards, source.categories)
      )
      const missing = missingStartingResourceColors({
        needed,
        resourceByColor,
        stockpile: sessionCardsRef.current.filter(
          (card) =>
            card.zone === PLAY_ZONE.stockpile && card.owner === seat
        ),
      })
      if (missing.length === 0) continue
      const stamped = stampStockpileWorldHomes(
        spawnGroupedStockpileResources(missing, resourceByColor, 0, seat),
        seat
      )
      for (const card of stamped) {
        dispatch({
          t: "tk",
          seat,
          cardId: card.cardId,
          name: card.name,
          artPath: card.artPath,
          artVersion: card.artVersion ?? null,
          cost: card.cost,
          x: card.x,
          y: card.y,
        })
      }
    }
  }, [
    status,
    deck,
    opponentDeck,
    resourcesReady,
    resourceByColor,
    netRole,
    mySeat,
    sessionCardsState,
    dispatch,
  ])

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
  const topRevealed = topRevealedBySeat[localSeat]
  const oppTopRevealed = topRevealedBySeat[oppSeat]
  const topLibraryCard = useMemo(
    () =>
      topRevealed
        ? (peekTopLibrary(sessionCardsState, 1, localSeat)[0] ?? null)
        : null,
    [sessionCardsState, topRevealed, localSeat]
  )
  /**
   * Opponent's revealed top card. Real card data only exists on this client
   * once fog/host state actually carries it (see `viewFor`'s reveal
   * exception) — otherwise the opponent's library stays count-only.
   */
  const oppTopLibraryCard = useMemo(
    () =>
      oppTopRevealed
        ? (peekTopLibrary(sessionCardsState, 1, oppSeat)[0] ?? null)
        : null,
    [sessionCardsState, oppTopRevealed, oppSeat]
  )

  const life = lifeBySeat[localSeat]
  const oppLife = lifeBySeat[oppSeat]
  const vp = vpBySeat[localSeat]
  const oppVp = vpBySeat[oppSeat]
  const vpGoal = vpGoalBySeat[localSeat]
  const oppVpGoal = vpGoalBySeat[oppSeat]
  const pilotGenBonus = pilotGenBySeat[localSeat]
  const oppPilotGenBonus = pilotGenBySeat[oppSeat]
  const pilotHandSize = pilotHandBySeat[localSeat]

  function moveCards(moves: { instanceId: string; x: number; y: number }[]) {
    if (moves.length === 0) return
    dispatch({
      t: "ps",
      i: moves.map((m) => {
        const world = displayToWorld(
          m.x,
          m.y,
          localSeat,
          displayFieldRef.current
        )
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
    // Ownership is the caller's job: FreeFloatSurface only ever passes your
    // own selection as a group, or a single explicitly double-clicked card
    // (which may be the opponent's — expend/ready is allowed either way).
    if (instanceIds.length === 0) return
    dispatch({ t: "xp", i: instanceIds })
  }

  function changeFloatSelection(instanceIds: string[]) {
    dispatch({ t: "sel", seat: localSeat, i: instanceIds })
    shareSelectionRef.current?.(
      sharedSelectionIds(sessionCardsRef.current, instanceIds)
    )
  }

  function changeHandSelection(instanceIds: string[]) {
    dispatch({ t: "sel", seat: localSeat, i: instanceIds })
    shareSelectionRef.current?.(
      sharedSelectionIds(sessionCardsRef.current, instanceIds)
    )
  }

  /** Peer click-highlight — do not echo back over the net. */
  const applyPeerSelection = useCallback((instanceIds: string[]) => {
    const next = applySharedSelection(
      sessionCardsRef.current,
      new Set(instanceIds)
    )
    sessionCardsRef.current = next
    setSessionCardsState(next)
  }, [sessionCardsRef])

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

    const libCount = cardsInZone(
      sessionCardsRef.current,
      PLAY_ZONE.library,
      localSeat
    ).length
    if (libCount > 0) {
      effectsRef.current.queueDrawsToHand?.(1)
    } else {
      dispatch({ t: "lf", seat: localSeat, d: -1 })
    }

    dispatch({ t: "ts", seat: localSeat })
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
      ? displayToWorld(at.x, at.y, localSeat, displayFieldRef.current)
      : undefined
    dispatch({
      t: "tk",
      seat: localSeat,
      cardId: template.id,
      name: template.card_name,
      artPath: template.card_thumbnail_path ?? template.card_art_path,
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
        ? displayToWorld(at.x, at.y, localSeat, displayFieldRef.current)
        : undefined
      dispatch({
        t: "tk",
        seat: localSeat,
        cardId: template.id,
        name: template.card_name,
        artPath: template.card_thumbnail_path ?? template.card_art_path,
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

  function setVpForLocal(next: number | ((prev: number) => number)) {
    const current = vpRef.current[localSeat]
    const value = typeof next === "function" ? next(current) : next
    dispatch({ t: "vp", seat: localSeat, d: value - current })
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
    vp,
    oppVp,
    vpGoal,
    oppVpGoal,
    setVp: setVpForLocal,
    turn,
    turnSeat,
    pilotGenBonus,
    oppPilotGenBonus,
    pilotHandSize,
    mulliganOpen,
    setMulliganOpen,
    topRevealed,
    oppTopRevealed,
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
    oppTopLibraryCard,
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
    applyPeerSelection,
    startTurn,
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
