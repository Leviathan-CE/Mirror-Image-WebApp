/**
 * Playtester — battlefield + hand + library; drag cards between zones.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets/shared"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { AccumulatePipChooser } from "@/components/Playtester/AccumulatePipChooser"
import {
  generatedResourceHome,
  placeInPlayForView,
} from "@/components/Playtester/augmentRow.logic"
import {
  autoResolveColors,
  buildResourceTokenMap,
  canAutoResolvePips,
  extractGainablePips,
  type GainablePip,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources.logic"
import { CardBottomSlideAnimation } from "@/components/Playtester/CardBottomSlideAnimation"
import { CardTuckUnderAnimation } from "@/components/Playtester/CardTuckUnderAnimation"
import { CardEnlargeOverlay } from "@/components/Playtester/CardLargeOverlay"
import {
  CardFlipFlyAnimation,
} from "@/components/Playtester/CardFlipFlyAnimation"
import {
  PLAY_ZONE,
  PILOT_PILE,
  HAND_CARD_SIZE,
  SELECTABLE_ACTION_ZONES,
  PLAYER_SLOT,
  otherSeat,
  type PlayerSlot,
} from "@/components/Playtester/playtesterConstants"
import { viewFor } from "@/components/Playtester/fogView.logic"
import { intentAllowed } from "@/components/Playtester/playNet.logic"
import { usePlayNet } from "@/components/Playtester/usePlayNet"
import type { SessionAction } from "@/components/Playtester/sessionActions.logic"
import { useCardDragDrop } from "@/components/Playtester/useCardDragDrop"
import { useDrawAnimations } from "@/components/Playtester/useDrawAnimations"
import {
  usePlaySession,
  type PlaySessionEffects,
} from "@/components/Playtester/usePlaySession"
import {
  genIconForCount,
  usePlayContextMenu,
  type CtxMenuState,
  type DeckActionCounts,
  type DeckCountKey,
} from "@/components/Playtester/usePlayContextMenu"
import { DeckPile } from "@/components/Playtester/DeckPile"
import { DeckPeekOverlay } from "@/components/Playtester/DeckPeekOverlay"
import { DeckShuffleAnimation } from "@/components/Playtester/DeckShuffleAnimation"
import { DeckSearchModal } from "@/components/Playtester/DeckSearchModal"
import {
  clampDeckCount,
  peekTopLibrary,
} from "@/components/Playtester/deckActions.logic"
import {
  FreeFloatSurface,
  type FloatSurfaceActions,
} from "@/components/Playtester/FreeFloatSurface"
import { LifeCounter } from "@/components/Playtester/LifeCounter"
import { FloatingHandPanel } from "@/components/Playtester/FloatingHandPanel"
import { PlayerHand } from "@/components/Playtester/PlayerHand"
import { TrashyardPile } from "@/components/Playtester/TrashyardPile"
import type { PlayingCardInstance } from "@/components/Playtester/types"
import { ContextMenu } from "@/components/ui/ContextMenu"
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "@/components/ui/DropdownMenu"
import {
  fetchCardLibrary,
  type CardLibraryItem,
} from "@/lib/api/cards"
import { cardArtUrl } from "@/lib/api/decks"
import { useDeckDetail } from "@/hooks/useDeckDetail"
import { ROUTES } from "@/lib/route"
import { GameIcon } from "@/components/common/GameIcon"

type AccumulateChooserState = {
  card: PlayingCardInstance
  pips: GainablePip[]
  from: { x: number; y: number; w: number; h: number }
}

type DeckPeekState = {
  title: string
  cards: PlayingCardInstance[]
  allowReorder: boolean
}

export function PlayTesterPage() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { deckId: deckIdParam, vsDeckId: vsDeckIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const deckId = Number(deckIdParam)
  const vsDeckId = Number(vsDeckIdParam)
  const [joinDraft, setJoinDraft] = useState(searchParams.get("room") ?? "")

  const playNet = usePlayNet({ token, localDeckId: deckId })
  const netActive = playNet.status !== "idle"
  const netRole =
    netActive && playNet.isHost
      ? "host"
      : netActive
        ? "guest"
        : "local"

  /** Hotseat view override — networked seats are fixed by the room. */
  const [hotseatSeat, setHotseatSeat] = useState<PlayerSlot>(PLAYER_SLOT.p1)
  /**
   * Seat this client's deck is dealt to. Host/solo is always p1; guest is
   * always p2. Do not trust playNet.seat here — a waiting host who briefly
   * landed on p2 would render their own library in the opponent row.
   */
  const mySeat = netRole === "guest" ? PLAYER_SLOT.p2 : PLAYER_SLOT.p1
  /** Seat drawn at the bottom of the table — always the one you control. */
  const localSeat = netActive ? mySeat : hotseatSeat

  // Room code unlocks preview / unpublished cards for both seats once the
  // opponent sits down, and lets the host read a private seated deck.
  const { deck, status, errorText } = useDeckDetail(
    deckId,
    token,
    playNet.poolRoom
  )
  const oppFetchId =
    playNet.isHost && playNet.peerDeckId
      ? playNet.peerDeckId
      : Number.isFinite(vsDeckId) && vsDeckId > 0
        ? vsDeckId
        : 0
  const vsDetail = useDeckDetail(oppFetchId, token, playNet.poolRoom)
  const opponentDeck =
    oppFetchId > 0 && vsDetail.status === "ready" ? vsDetail.deck : null
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)
  /** Sticky zoom from context menu (middle-mouse zoom stays local to each zone). */
  const [inspectCard, setInspectCard] = useState<PlayingCardInstance | null>(
    null
  )
  const [accumulateChooser, setAccumulateChooser] =
    useState<AccumulateChooserState | null>(null)
  /** Deck row counts persist for the whole playtester session. */
  const [deckActionCounts, setDeckActionCounts] = useState<DeckActionCounts>({
    degrade: "1",
    lookTop: "1",
    putBottom: "1",
  })
  const [deckPeek, setDeckPeek] = useState<DeckPeekState | null>(null)
  const [deckSearchOpen, setDeckSearchOpen] = useState(false)
  const [resourceTokens, setResourceTokens] = useState<CardLibraryItem[]>([])
  const [resourcesReady, setResourcesReady] = useState(false)
  const [vsDraft, setVsDraft] = useState("")
  const [playNotice, setPlayNotice] = useState<string | null>(null)
  const [fieldSizePx, setFieldSizePx] = useState({ width: 0, height: 0 })
  const surfaceRef = useRef<HTMLDivElement>(null)
  const stockpileRef = useRef<HTMLDivElement>(null)
  const pilotRef = useRef<HTMLDivElement>(null)
  const handRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<HTMLDivElement>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const dismantledRef = useRef<HTMLDivElement>(null)

  const resourceByColor = useMemo(
    () => buildResourceTokenMap(resourceTokens),
    [resourceTokens]
  )
  const availableResourceColors = useMemo(
    () => new Set(resourceByColor.keys()),
    [resourceByColor]
  )

  const effectsRef = useRef<Partial<PlaySessionEffects>>({})
  const {
    sessionCards,
    setSessionCards,
    sessionCardsRef,
    life,
    setLife,
    turn,
    pilotGenBonus,
    mulliganOpen,
    topRevealed,
    setTopRevealed,
    handCards,
    pilotCards,
    libraryCount,
    topLibraryCard,
    trashCards,
    dismantledCards,
    moveCards: onMoveCards,
    bringToFront: onBringToFront,
    toggleExpendedIds: onToggleExpended,
    changeFloatSelection: onFloatSelectionChange,
    changeHandSelection: onHandSelectionChange,
    startTurn,
    endTurn,
    deleteCards: deleteSessionCards,
    adjustCounters: adjustCardCounters,
    spawnResourceColor: spawnResourceColorCore,
    adjustPilotGenBonus,
    putOnLibraryBottom,
    setFaceDown,
    duplicateCards,
    moveAll,
    putDeckTopOnBottom: putDeckTopOnBottomCards,
    shuffleLibraryCards,
    reorderTop,
    finishAccumulateSpawn,
    dispatch,
    applyFog,
    snapshot,
    twoSeat,
    turnSeat,
    oppHandCards,
    oppLibraryCount,
    oppTrashCards,
    oppDismantledCards,
    oppPilotCards,
    oppLife,
  } = usePlaySession({
    status,
    deck,
    opponentDeck,
    resourceByColor,
    resourcesReady,
    effectsRef,
    localSeat,
    mySeat,
    netRole,
    peerPresent: playNet.peerPresent,
    sendIntent: (action: SessionAction) => {
      playNet.send({ type: "intent", action })
    },
    onHostCommit: (action, state) => {
      if (!playNet.isHost) return
      playNet.send({ type: "fog", view: viewFor(otherSeat(mySeat), state) })
      if (action) playNet.send({ type: "event", action })
    },
  })

  function clientToLocalIn(
    el: HTMLElement | null,
    clientX: number,
    clientY: number
  ) {
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: Math.max(0, clientX - rect.left - 56),
      y: Math.max(0, clientY - rect.top - 72),
    }
  }

  function clientToSurfaceLocal(clientX: number, clientY: number) {
    return clientToLocalIn(surfaceRef.current, clientX, clientY)
  }

  function clientToStockpileLocal(clientX: number, clientY: number) {
    return clientToLocalIn(stockpileRef.current, clientX, clientY)
  }

  useEffect(() => {
    const room = searchParams.get("room")
    if (!room || !token || playNet.status !== "idle") return
    if (playNet.isHost || playNet.code) return
    playNet.joinRoom(room)
  }, [searchParams, token, playNet.status, playNet.joinRoom])

  useEffect(() => {
    if (playNet.code && searchParams.get("room") !== playNet.code) {
      setSearchParams({ room: playNet.code }, { replace: true })
    }
  }, [playNet.code, searchParams, setSearchParams])

  useEffect(() => {
    playNet.setHandlers({
      onIntent: (msg) => {
        if (!playNet.isHost) return
        const actor = otherSeat(mySeat)
        if (
          !intentAllowed(msg.action, actor, (id) =>
            sessionCardsRef.current.find((c) => c.instanceId === id)?.owner
          )
        ) {
          return
        }
        dispatch(msg.action)
      },
      onFog: (view) => {
        if (playNet.isHost) return
        applyFog(view)
      },
      onSnapshot: () => {
        if (!playNet.isHost) return
        playNet.send({
          type: "fog",
          view: viewFor(otherSeat(mySeat), snapshot()),
        })
      },
    })
  }, [
    playNet.setHandlers,
    playNet.isHost,
    playNet.send,
    mySeat,
    dispatch,
    applyFog,
    snapshot,
    sessionCardsRef,
  ])

  const zoneRefs = {
    deck: deckRef,
    hand: handRef,
    surface: surfaceRef,
    stockpile: stockpileRef,
    pilot: pilotRef,
    trash: trashRef,
    dismantled: dismantledRef,
  }

  const {
    flipAnims,
    bottomAnim,
    animBusy,
    isFlipFlying,
    hasPendingDrawTimers,
    pushFlipAnim,
    tuckAnims,
    onTuckAnimComplete,
    queueTuckUnderDeck,
    shuffleAnim,
    startDeckShuffle,
    onShuffleAnimComplete,
    onDrawFromDeck,
    queueDrawsToHand,
    queueDegradeToTrashyard,
    queueStockpileTimeCompletions,
    onDeckTopRelease,
    onFlipAnimComplete,
    startBottomSlide,
    onBottomSlideComplete,
    clearDrawTimers,
    flyingIds,
    hideFlying,
  } = useDrawAnimations({
    sessionCardsRef,
    dispatch,
    localSeat,
    zoneRefs,
    clientToSurfaceLocal,
    mulliganOpen,
  })

  effectsRef.current = {
    clearDrawTimers,
    queueStockpileTimeCompletions,
    queueDrawsToHand,
  }

  const {
    onHandRelease,
    onBattlefieldRelease,
    onFaceUpPileRelease,
    onLibraryCardRelease,
  } = useCardDragDrop({
    sessionCards,
    setSessionCards,
    dispatch,
    localSeat,
    hideFlying,
    zoneRefs,
    clientToSurfaceLocal,
    clientToStockpileLocal,
    isFlipFlying,
    pushFlipAnim,
  })

  const flyingHide = useMemo(() => new Set(flyingIds), [flyingIds])
  const visHand = handCards.filter((c) => !flyingHide.has(c.instanceId))
  const visOppHand = oppHandCards.filter((c) => !flyingHide.has(c.instanceId))
  const visInPlay = placeInPlayForView(
    sessionCards.filter(
      (c) =>
        (c.zone === PLAY_ZONE.battlefield || c.zone === PLAY_ZONE.stockpile) &&
        !flyingHide.has(c.instanceId)
    ),
    localSeat,
    fieldSizePx
  )
  const visTrash = trashCards.filter((c) => !flyingHide.has(c.instanceId))
  const visOppTrash = oppTrashCards.filter((c) => !flyingHide.has(c.instanceId))
  const visDismantled = dismantledCards.filter(
    (c) => !flyingHide.has(c.instanceId)
  )
  const visOppDismantled = oppDismantledCards.filter(
    (c) => !flyingHide.has(c.instanceId)
  )
  const visPilot = pilotCards.filter((c) => !flyingHide.has(c.instanceId))
  const visOppPilot = oppPilotCards.filter((c) => !flyingHide.has(c.instanceId))

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const sync = () => {
      const rect = el.getBoundingClientRect()
      setFieldSizePx({ width: rect.width, height: rect.height })
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [status, twoSeat])

  useEffect(() => {
    if (status !== "ready") {
      setResourceTokens([])
      setResourcesReady(false)
      return
    }
    let cancelled = false
    setResourcesReady(false)

    // Resource tokens: identify by super type Resource + invoke-cost colour.
    void Promise.all([
      fetchCardLibrary({ superType: "Resource", limit: 100, offset: 0 }, token),
    ])
      .then((results) => {
        if (cancelled) return
        const byId = new Map<number, CardLibraryItem>()
        for (const res of results) {
          for (const item of res.items) {
            byId.set(item.id, item)
          }
        }
        setResourceTokens([...byId.values()])
        setResourcesReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setResourceTokens([])
          setResourcesReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [status, token])

  // Delete / Backspace removes selected hand / battlefield / stockpile cards.
  useEffect(() => {
    if (status !== "ready") return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      if (
        mulliganOpen ||
        accumulateChooser ||
        inspectCard ||
        deckPeek ||
        deckSearchOpen
      ) {
        return
      }

      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return
        }
      }

      const selectable = SELECTABLE_ACTION_ZONES as readonly string[]
      const ids = sessionCardsRef.current
        .filter((c) => c.selected && selectable.includes(c.zone))
        .map((c) => c.instanceId)
      if (ids.length === 0) return

      event.preventDefault()
      deleteSessionCards(ids)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    status,
    mulliganOpen,
    accumulateChooser,
    inspectCard,
    deckPeek,
    deckSearchOpen,
    deleteSessionCards,
    sessionCardsRef,
  ])

  function onStartTurn() {
    startTurn(Boolean(mulliganOpen || bottomAnim))
  }

  function onEndTurn() {
    endTurn(Boolean(mulliganOpen || bottomAnim || hasPendingDrawTimers()))
  }

  function cardScreenRect(instanceId: string): {
    x: number
    y: number
    w: number
    h: number
  } {
    const el = document.querySelector(
      `[data-playtester-instance="${instanceId}"]`
    ) as HTMLElement | null
    if (el) {
      const r = el.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    }
    const hand = handRef.current?.getBoundingClientRect()
    return {
      x: hand ? hand.left + 12 : 24,
      y: hand ? hand.top + 8 : 24,
      w: HAND_CARD_SIZE.defaultWidth,
      h: HAND_CARD_SIZE.defaultHeight,
    }
  }

  function finishAccumulate(
    card: PlayingCardInstance,
    colors: ResourceColor[],
    from: { x: number; y: number; w: number; h: number }
  ) {
    finishAccumulateSpawn(
      card,
      colors,
      colors.map((_, index) =>
        generatedResourceHome(fieldSizePx, true, index)
      )
    )
    startBottomSlide(card, from)
  }

  function startAccumulate(instanceId: string) {
    setCtxMenu(null)
    if (animBusy) return

    const card = sessionCards.find(
      (c) => c.instanceId === instanceId && c.zone === PLAY_ZONE.hand
    )
    if (!card) return

    const pips = extractGainablePips(card.cost)
    if (pips.length === 0) {
      setPlayNotice("No coloured invoke-cost pips on this card.")
      return
    }

    const from = cardScreenRect(instanceId)

    if (canAutoResolvePips(pips)) {
      const colors = autoResolveColors(pips).filter((c) =>
        resourceByColor.has(c)
      )
      if (colors.length > 0) {
        finishAccumulate(card, colors, from)
        return
      }
      setPlayNotice(
        "No matching Resource Token cards in the catalogue for those colours."
      )
      return
    }

    // Hybrids / MULTI / more than 3 pips — let the player choose.
    setAccumulateChooser({ card, pips, from })
  }

  function onHandContextMenu(
    instanceId: string,
    clientX: number,
    clientY: number
  ) {
    setPlayNotice(null)
    setCtxMenu({ kind: "card", instanceId, x: clientX, y: clientY })
  }

  function onFloatCardContextMenu(
    instanceId: string,
    clientX: number,
    clientY: number
  ) {
    setPlayNotice(null)
    setCtxMenu({ kind: "card", instanceId, x: clientX, y: clientY })
  }

  function onZoneEmptyContextMenu(
    zone: "hand" | "battlefield" | "stockpile",
    clientX: number,
    clientY: number
  ) {
    setPlayNotice(null)
    setCtxMenu({ kind: "zone", zone, x: clientX, y: clientY })
  }

  function onFloatCardCounterAdjust(
    instanceId: string,
    kind: Parameters<typeof adjustCardCounters>[1],
    delta: number
  ) {
    adjustCardCounters([instanceId], kind, delta)
  }

  function spawnResourceColor(color: ResourceColor) {
    spawnResourceColorCore(
      color,
      () => {
        setPlayNotice(`No catalog card loaded for ${color}.`)
      },
      generatedResourceHome(fieldSizePx, true, 0)
    )
  }

  function setDeckActionCount(key: DeckCountKey, value: string) {
    setDeckActionCounts((prev) => ({ ...prev, [key]: value }))
  }

  function onDeckContextMenu(clientX: number, clientY: number) {
    setPlayNotice(null)
    setCtxMenu({ kind: "deck", x: clientX, y: clientY })
  }

  function onFaceUpPileContextMenu(
    zone: typeof PLAY_ZONE.trashyard | typeof PLAY_ZONE.dismantled,
    clientX: number,
    clientY: number
  ) {
    setPlayNotice(null)
    setCtxMenu({ kind: "faceUpPile", zone, x: clientX, y: clientY })
  }

  function degradeDeck(count: number) {
    const n = clampDeckCount(count, libraryCount)
    if (n <= 0) return
    if (hasPendingDrawTimers() || isFlipFlying()) return
    queueDegradeToTrashyard(n)
    setPlayNotice(`Degraded ${n}.`)
  }

  function lookAtDeckTop(count: number) {
    const n = clampDeckCount(count, libraryCount)
    if (n <= 0) return
    const peeked = peekTopLibrary(sessionCardsRef.current, n, localSeat)
    setDeckPeek({
      title: `Look at top ${peeked.length}`,
      cards: peeked,
      allowReorder: true,
    })
  }

  function putDeckTopOnBottom(count: number) {
    const n = clampDeckCount(count, libraryCount)
    if (n <= 0) return
    if (hasPendingDrawTimers() || isFlipFlying()) return
    putDeckTopOnBottomCards(n)
    queueTuckUnderDeck(n)
    setPlayNotice(
      n === 1
        ? "Top card put on the bottom."
        : `Top ${n} cards put on the bottom.`
    )
  }

  function shuffleLibraryNow(notice: string) {
    shuffleLibraryCards()
    startDeckShuffle()
    setPlayNotice(notice)
  }

  function shuffleDeck() {
    if (hasPendingDrawTimers() || isFlipFlying()) return
    shuffleLibraryNow("Deck shuffled.")
  }

  function toggleDeckTopRevealed() {
    if (!topRevealed && libraryCount <= 0) {
      setPlayNotice("Deck is empty.")
      return
    }
    const next = !topRevealed
    setTopRevealed(next)
    setPlayNotice(next ? "Top card revealed." : "Top card hidden.")
  }

  function onDeckPeekDone(orderedCards: PlayingCardInstance[]) {
    const peek = deckPeek
    setDeckPeek(null)
    if (!peek?.allowReorder || orderedCards.length === 0) return
    reorderTop(orderedCards.map((c) => c.instanceId))
  }

  function openDeckSearch() {
    if (libraryCount <= 0) return
    setDeckSearchOpen(true)
  }

  /** Searching the deck means shuffling it afterwards, however you close it. */
  function closeDeckSearch() {
    setDeckSearchOpen(false)
    if (libraryCount <= 0) return
    shuffleLibraryNow("Deck searched — shuffled.")
  }

  const floatSurfaceActions: FloatSurfaceActions = {
    onMoveCards,
    onBringToFront,
    onToggleExpended,
    onCardContextMenu: onFloatCardContextMenu,
    onCardCounterAdjust: onFloatCardCounterAdjust,
  }

  const pilotGenOverlay =
    pilotGenBonus > 0 ? (
      <span
        data-pilot-gen-badge=""
        role="button"
        tabIndex={0}
        title={`Pilot +GEN ${pilotGenBonus} · left-click +1 · right-click −1`}
        className="inline-flex items-center gap-0.5 border border-cyan-400/60 bg-black/85 px-1.5 py-1 font-buahs93 text-base leading-none text-cyan-100"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          adjustPilotGenBonus(1)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          adjustPilotGenBonus(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "+") {
            event.preventDefault()
            adjustPilotGenBonus(1)
          } else if (event.key === "-" || event.key === "Backspace") {
            event.preventDefault()
            adjustPilotGenBonus(-1)
          }
        }}
      >
        +
        <GameIcon name={genIconForCount(pilotGenBonus)} className="h-5 w-auto" />
      </span>
    ) : null

  function leavePlaytester() {
    if (Number.isFinite(deckId) && deckId > 0) {
      // Replace so browser Back from the deck does not reopen playtester.
      navigate(ROUTES.deck(deckId), { replace: true })
      return
    }
    navigate(ROUTES.MAIN)
  }

  function startHotseatVs() {
    const id = Number(vsDraft)
    if (!Number.isFinite(id) || id <= 0) {
      setPlayNotice("Enter a numeric deck id to play hotseat.")
      return
    }
    navigate(ROUTES.playTesterVs(deckId, id))
  }

  const playMenuItems: DropdownMenuItem[] = [
    {
      id: "playtester-back",
      label: "← Back to deck",
      onSelect: leavePlaytester,
    },
  ]

  if (twoSeat && !netActive) {
    playMenuItems.push({
      id: "playtester-swap-seat",
      label: `Swap seat · now ${localSeat}`,
      onSelect: () => setHotseatSeat((s) => (s === "p1" ? "p2" : "p1")),
    })
  } else if (!twoSeat) {
    playMenuItems.push({
      id: "playtester-hotseat",
      label: "Hotseat vs",
      onSelect: startHotseatVs,
      textInput: {
        value: vsDraft,
        onChange: setVsDraft,
        placeholder: "deck id",
        ariaLabel: "Opponent deck id",
      },
    })
  }

  if (netActive) {
    playMenuItems.push({
      id: "playtester-copy-code",
      label: "Copy room code",
      disabled: !playNet.code,
      onSelect: () => {
        void navigator.clipboard.writeText(playNet.code ?? "")
        setPlayNotice(`Room ${playNet.code} copied.`)
      },
    })
    if (playNet.status === "disconnected") {
      playMenuItems.push({
        id: "playtester-reconnect",
        label: "Reconnect",
        disabled: !playNet.code,
        onSelect: () => playNet.joinRoom(playNet.code ?? ""),
      })
    }
    playMenuItems.push({
      id: "playtester-leave-room",
      label: "Leave room",
      tone: "danger",
      onSelect: () => {
        playNet.leaveRoom()
        setSearchParams({}, { replace: true })
      },
    })
  } else {
    playMenuItems.push(
      {
        id: "playtester-create-room",
        label: "Create room",
        onSelect: () => {
          void playNet.createRoom()
        },
      },
      {
        id: "playtester-join-room",
        label: "Join room",
        onSelect: () => playNet.joinRoom(joinDraft),
        textInput: {
          value: joinDraft,
          onChange: setJoinDraft,
          placeholder: "code",
          ariaLabel: "Room code",
          uppercase: true,
        },
      }
    )
  }

  const roomStatusText = netActive
    ? [
        playNet.code ?? "ROOM",
        playNet.status === "waiting"
          ? "waiting"
          : playNet.transport === "p2p"
            ? "p2p"
            : playNet.transport === "relay"
              ? "relay"
              : playNet.status,
        playNet.seat,
      ]
        .filter(Boolean)
        .join(" · ")
    : null

  const ctxMenuItems = usePlayContextMenu({
    ctxMenu,
    sessionCards,
    resourceByColor,
    availableResourceColors,
    animBusy: animBusy || hasPendingDrawTimers(),
    pilotGenBonus,
    deckActionCounts,
    setDeckActionCount,
    topRevealed,
    owner: localSeat,
    actions: {
      spawnResourceColor,
      putOnLibraryBottom,
      setFaceDown,
      deleteSessionCards,
      startAccumulate,
      adjustCounter: adjustCardCounters,
      duplicateCard: duplicateCards,
      inspectCard: (card) => setInspectCard(card),
      adjustPilotGenBonus,
      toggleExpended: onToggleExpended,
      degradeDeck,
      lookAtDeckTop,
      putDeckTopOnBottom,
      shuffleDeck,
      toggleDeckTopRevealed,
      openDeckSearch,
      moveAllFromZone: moveAll,
      moveInPlayToZone: (instanceIds, zone) => {
        instanceIds.forEach((id) => {
          const card = sessionCards.find((c) => c.instanceId === id)
          if (!card || card.owner !== localSeat) return
          const shown = visInPlay.find((c) => c.instanceId === id)
          dispatch({
            t: "mv",
            seat: localSeat,
            i: [id],
            z: zone,
            x: card.x ?? shown?.x ?? 0,
            y: card.y ?? shown?.y ?? 0,
          })
        })
      },
    },
  })
  return (
    <section
      className="relative flex h-svh flex-col overflow-hidden bg-cover bg-center bg-no-repeat select-none"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex items-start justify-between gap-2 p-2">
        <div className="pointer-events-auto relative z-[70]">
          <DropdownMenu
            label="Playtester menu"
            trigger="☰"
            items={playMenuItems}
            triggerClassName="h-7 w-9 border border-cyan-500/40 bg-cyan-700/80 text-sm text-cyan-50 hover:bg-cyan-900"
            menuClassName="z-[70] min-w-[13rem]"
          />
        </div>

        <div className="flex max-w-[55%] flex-col items-end gap-0.5 text-right">
          {roomStatusText ? (
            <span className="font-mono text-[10px] text-cyan-100/80">
              {roomStatusText}
            </span>
          ) : null}
          {playNotice ? (
            <p className="font-mono text-xs text-amber-200/90" role="status">
              {playNotice}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-2">
        {status === "error" ? (
          <p className="mt-7 font-mono text-sm text-red-400" role="alert">
            {errorText}
          </p>
        ) : null}
        {playNet.errorText ? (
          <p className="mt-7 font-mono text-sm text-amber-200" role="status">
            {playNet.errorText}
          </p>
        ) : null}
        {netActive && playNet.status === "waiting" ? (
          <p className="font-mono text-xs text-cyan-100/80" role="status">
            Waiting for opponent — share code {playNet.code}
          </p>
        ) : null}
        {playNet.status === "disconnected" ? (
          <p className="font-mono text-xs text-amber-200" role="status">
            Connection lost. Reconnect to request a fog snapshot.
          </p>
        ) : null}
        {playNet.isHost &&
        oppFetchId > 0 &&
        vsDetail.status === "error" ? (
          <p className="font-mono text-xs text-amber-200" role="status">
            Could not load opponent deck {oppFetchId}. Their table will stay
            empty until that deck is public or shared.
          </p>
        ) : null}
        {netActive && playNet.status === "connected" && !playNet.peerPresent ? (
          <p className="font-mono text-xs text-amber-200" role="status">
            Opponent disconnected.
          </p>
        ) : null}

        {status === "ready" ? (
          <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-1">
            <div className="flex min-h-0 min-w-0 flex-1">
              {twoSeat ? (
                <div
                  className="z-40 flex shrink-0 flex-col items-center justify-start gap-1 py-1 opacity-90"
                  style={{ width: PILOT_PILE.w }}
                >
                  <div className="rotate-180">
                    <TrashyardPile
                      cards={visOppPilot}
                      label="Opp pilot"
                      size="lg"
                      onReleaseCard={() => undefined}
                    />
                  </div>
                  <div className="rotate-180">
                    <DeckPile
                      count={oppLibraryCount}
                      label="Opp library"
                      busy
                      size="lg"
                    />
                  </div>
                  <div className="rotate-180">
                    <TrashyardPile
                      cards={visOppTrash}
                      label="Opp trash"
                      size="lg"
                      onReleaseCard={() => undefined}
                    />
                  </div>
                  <div className="rotate-180">
                    <TrashyardPile
                      cards={visOppDismantled}
                      label="Opp dismantled"
                      size="lg"
                      onReleaseCard={() => undefined}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
                <div
                  ref={surfaceRef}
                  className="relative z-0 min-h-0 min-w-0 flex-1"
                >
                  <FreeFloatSurface
                    plain
                    localSeat={localSeat}
                    className="h-full min-h-0 w-full"
                    cards={visInPlay}
                    actions={floatSurfaceActions}
                    onSelectionChange={onFloatSelectionChange}
                    onCardsReleased={onBattlefieldRelease}
                    onEmptyContextMenu={(x, y) =>
                      onZoneEmptyContextMenu("battlefield", x, y)
                    }
                  />
                  {twoSeat ? (
                    <FloatingHandPanel
                      parentSize={fieldSizePx}
                      anchor="top"
                      label={`Opp hand · ${visOppHand.length}`}
                      center={
                        <LifeCounter
                          life={oppLife}
                          onAdjust={() => undefined}
                          className="min-h-12 px-6 py-1 text3xl"
                        />
                      }
                    >
                      <div className="h-full min-h-0 rotate-180">
                        <PlayerHand
                          className="h-full min-h-0"
                          cards={visOppHand}
                          hideFaces
                          interactive={false}
                          embedded
                          onReleaseCards={() => undefined}
                        />
                      </div>
                    </FloatingHandPanel>
                  ) : null}
                  <FloatingHandPanel
                    parentSize={fieldSizePx}
                    anchor="bottom"
                    panelRef={handRef}
                    label={`Hand · ${visHand.length}`}
                    center={
                      <LifeCounter
                        life={life}
                        onAdjust={(delta) =>
                          setLife((prev) => Math.max(0, prev + delta))
                        }
                        className="min-h-12 px-6 py-1 text-4xl"
                      />
                    }
                  >
                    <PlayerHand
                      className="h-full min-h-0"
                      cards={visHand}
                      embedded
                      onReleaseCards={onHandRelease}
                      onCardContextMenu={onHandContextMenu}
                      onEmptyContextMenu={(x, y) =>
                        onZoneEmptyContextMenu("hand", x, y)
                      }
                      onSelectionChange={onHandSelectionChange}
                    />
                  </FloatingHandPanel>
                </div>
              </div>

              <div
                className="z-40 flex shrink-0 flex-col items-center justify-end gap-1 py-1"
                style={{ width: PILOT_PILE.w }}
              >
                <TrashyardPile
                  ref={pilotRef}
                  cards={visPilot}
                  label="Pilot"
                  size="lg"
                  onReleaseCard={onFaceUpPileRelease}
                  onCardContextMenu={onFloatCardContextMenu}
                  onToggleExpended={(instanceId) =>
                    onToggleExpended([instanceId])
                  }
                  cardOverlay={pilotGenOverlay}
                />
                <DeckPile
                  ref={deckRef}
                  count={libraryCount}
                  size="lg"
                  onClickDraw={onDrawFromDeck}
                  onTopCardRelease={onDeckTopRelease}
                  onContextMenu={onDeckContextMenu}
                  topCard={topLibraryCard}
                  topRevealed={topRevealed}
                  busy={Boolean(bottomAnim) || mulliganOpen || deckSearchOpen}
                />
                <TrashyardPile
                  ref={trashRef}
                  cards={visTrash}
                  label="Trashyard"
                  size="lg"
                  onReleaseCard={onFaceUpPileRelease}
                  onCardContextMenu={onFloatCardContextMenu}
                  onPileContextMenu={(x, y) =>
                    onFaceUpPileContextMenu(PLAY_ZONE.trashyard, x, y)
                  }
                />
                <TrashyardPile
                  ref={dismantledRef}
                  cards={visDismantled}
                  label="Dismantled"
                  size="lg"
                  onReleaseCard={onFaceUpPileRelease}
                  onCardContextMenu={onFloatCardContextMenu}
                  onPileContextMenu={(x, y) =>
                    onFaceUpPileContextMenu(PLAY_ZONE.dismantled, x, y)
                  }
                />
              </div>
            </div>

            <div className="relative z-40 flex shrink-0 items-center gap-2 border-t border-cyan-500/25 bg-black/55 px-2 py-1.5">
              <GlitchFx
                type="button"
                label="START TURN"
                disabled={
                  mulliganOpen ||
                  Boolean(bottomAnim) ||
                  (netActive && turnSeat !== localSeat)
                }
                className="font-buahs93 h-7 rounded-none bg-cyan-700 px-3 text-xs hover:bg-cyan-900 disabled:opacity-40"
                onClick={onStartTurn}
              />
              <GlitchFx
                type="button"
                label="END TURN"
                disabled={
                  mulliganOpen ||
                  Boolean(bottomAnim) ||
                  (netActive && turnSeat !== localSeat)
                }
                className="font-buahs93 h-7 rounded-none bg-cyan-700 px-3 text-xs hover:bg-cyan-900 disabled:opacity-40"
                onClick={onEndTurn}
              />
              <span
                className="ml-auto font-buahs93 text-sm tracking-wide text-cyan-100/90"
                aria-live="polite"
              >
                Turn {turn}
                {twoSeat ? ` · ${turnSeat}` : ""}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {flipAnims.map((anim) => (
        <CardFlipFlyAnimation
          key={anim.id}
          card={anim.card}
          mode={anim.mode}
          from={anim.from}
          to={anim.to}
          onComplete={() => onFlipAnimComplete(anim.id)}
        />
      ))}

      {shuffleAnim ? (
        <DeckShuffleAnimation
          from={shuffleAnim.from}
          onComplete={onShuffleAnimComplete}
        />
      ) : null}

      {tuckAnims.map((anim) => (
        <CardTuckUnderAnimation
          key={anim.id}
          from={anim.from}
          onComplete={() => onTuckAnimComplete(anim.id)}
        />
      ))}

      {bottomAnim ? (
        <CardBottomSlideAnimation
          card={bottomAnim.card}
          from={bottomAnim.from}
          to={bottomAnim.to}
          onComplete={onBottomSlideComplete}
        />
      ) : null}

      <ContextMenu
        open={Boolean(ctxMenu)}
        x={ctxMenu?.x ?? 0}
        y={ctxMenu?.y ?? 0}
        items={ctxMenuItems}
        onClose={() => setCtxMenu(null)}
        label="Card actions"
      />

      <CardEnlargeOverlay
        open={inspectCard != null}
        name={inspectCard?.name ?? ""}
        artSrc={
          inspectCard?.isClassified
            ? null
            : inspectCard
              ? cardArtUrl(inspectCard.artPath, inspectCard.artVersion)
              : null
        }
        classification={
          inspectCard?.classification ??
          (inspectCard?.isClassified ? "classified" : null)
        }
        onDismiss={() => setInspectCard(null)}
      />

      {accumulateChooser ? (
        <AccumulatePipChooser
          cardName={accumulateChooser.card.name}
          pips={accumulateChooser.pips}
          availableColors={availableResourceColors}
          onCancel={() => setAccumulateChooser(null)}
          onConfirm={(colors) => {
            const pending = accumulateChooser
            setAccumulateChooser(null)
            finishAccumulate(pending.card, colors, pending.from)
          }}
        />
      ) : null}

      <DeckPeekOverlay
        open={Boolean(deckPeek)}
        title={deckPeek?.title ?? ""}
        cards={deckPeek?.cards ?? []}
        allowReorder={deckPeek?.allowReorder ?? false}
        onClose={onDeckPeekDone}
      />

      <DeckSearchModal
        open={deckSearchOpen}
        sessionCards={sessionCards}
        owner={localSeat}
        onCancel={closeDeckSearch}
        onCardRelease={onLibraryCardRelease}
        onCardContextMenu={onFloatCardContextMenu}
      />
    </section>
  )
}
