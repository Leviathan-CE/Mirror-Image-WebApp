/**
 * Playtester — battlefield + hand + library; drag cards between zones.
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets/shared"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { AccumulatePipChooser } from "@/components/Playtester/AccumulatePipChooser"
import { placeAugmentsForView } from "@/components/Playtester/augmentRow.logic"
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
  PLAYTESTER_STORAGE,
  SELECTABLE_ACTION_ZONES,
  STOCKPILE_HEIGHT,
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
import { PilotSidebar } from "@/components/Playtester/PilotSidebar"
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

/** The opponent's half of the field and their stockpile are display-only. */
const READ_ONLY_FLOAT_ACTIONS: FloatSurfaceActions = {
  onMoveCards: () => undefined,
  onBringToFront: () => undefined,
  onToggleExpended: () => undefined,
}

function clampStockpileHeight(height: number): number {
  return Math.min(
    STOCKPILE_HEIGHT.max,
    Math.max(STOCKPILE_HEIGHT.min, Math.round(height))
  )
}

function readStoredStockpileHeight(): number {
  try {
    const raw = window.localStorage.getItem(PLAYTESTER_STORAGE.stockpileHeightPx)
    const parsed = raw == null ? NaN : Number(raw)
    return Number.isFinite(parsed)
      ? clampStockpileHeight(parsed)
      : STOCKPILE_HEIGHT.default
  } catch {
    return STOCKPILE_HEIGHT.default
  }
}

function readStoredPilotSidebarOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(PLAYTESTER_STORAGE.pilotSidebarOpen)
    if (raw === "1") return true
    if (raw === "0") return false
  } catch {
    /* ignore */
  }
  return false
}

function readStoredOppPilotSidebarOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(
      PLAYTESTER_STORAGE.oppPilotSidebarOpen
    )
    if (raw === "1") return true
    if (raw === "0") return false
  } catch {
    /* ignore */
  }
  return false
}

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
  const [stockpileHeightPx, setStockpileHeightPx] = useState<number>(
    STOCKPILE_HEIGHT.default
  )
  const [battlefieldHeightPx, setBattlefieldHeightPx] = useState(320)
  const [pilotSidebarOpen, setPilotSidebarOpen] = useState(false)
  const [oppPilotSidebarOpen, setOppPilotSidebarOpen] = useState(false)
  const stockpileResizeRef = useRef<{
    pointerId: number
    startY: number
    startHeight: number
  } | null>(null)
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
    battlefieldCards,
    localStockpileCards,
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
    oppStockpileCards,
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
    clientToStockpileLocal,
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
    onStockpileRelease,
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
    onZoneDrop: (zone) => {
      if (zone === PLAY_ZONE.pilot) setPilotSidebarOpen(true)
    },
  })

  const flyingHide = useMemo(() => new Set(flyingIds), [flyingIds])
  const visHand = handCards.filter((c) => !flyingHide.has(c.instanceId))
  const visOppHand = oppHandCards.filter((c) => !flyingHide.has(c.instanceId))
  const visBf = placeAugmentsForView(
    battlefieldCards.filter((c) => !flyingHide.has(c.instanceId)),
    localSeat,
    battlefieldHeightPx
  )
  const visStock = localStockpileCards.filter(
    (c) => !flyingHide.has(c.instanceId)
  )
  const visOppStock = oppStockpileCards.filter(
    (c) => !flyingHide.has(c.instanceId)
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
    setStockpileHeightPx(readStoredStockpileHeight())
    setPilotSidebarOpen(readStoredPilotSidebarOpen())
    setOppPilotSidebarOpen(readStoredOppPilotSidebarOpen())
  }, [])

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const sync = () => setBattlefieldHeightPx(el.getBoundingClientRect().height)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [status, twoSeat])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PLAYTESTER_STORAGE.stockpileHeightPx,
        String(stockpileHeightPx)
      )
    } catch {
      /* private mode / quota */
    }
  }, [stockpileHeightPx])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PLAYTESTER_STORAGE.pilotSidebarOpen,
        pilotSidebarOpen ? "1" : "0"
      )
    } catch {
      /* private mode / quota */
    }
  }, [pilotSidebarOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PLAYTESTER_STORAGE.oppPilotSidebarOpen,
        oppPilotSidebarOpen ? "1" : "0"
      )
    } catch {
      /* private mode / quota */
    }
  }, [oppPilotSidebarOpen])

  function onStockpileResizePointerDown(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    stockpileResizeRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: stockpileHeightPx,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onStockpileResizePointerMove(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag = stockpileResizeRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    // Drag handle upward = taller stockpile; downward = more battlefield.
    setStockpileHeightPx(
      clampStockpileHeight(drag.startHeight - (event.clientY - drag.startY))
    )
  }

  function onStockpileResizePointerUp(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag = stockpileResizeRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    stockpileResizeRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

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
      w: 96,
      h: 128,
    }
  }

  function finishAccumulate(
    card: PlayingCardInstance,
    colors: ResourceColor[],
    from: { x: number; y: number; w: number; h: number }
  ) {
    finishAccumulateSpawn(card, colors)
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
    spawnResourceColorCore(color, () => {
      setPlayNotice(`No catalog card loaded for ${color}.`)
    })
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
            {twoSeat ? (
              <div className="relative z-40 shrink-0 rotate-180 overflow-visible">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] flex translate-y-[calc(100%+0.5rem)] justify-end pr-2">
                  <LifeCounter
                    life={oppLife}
                    onAdjust={() => undefined}
                    className="pointer-events-auto w-auto min-h-14 min-w-[4.5rem] rotate-180 px-4 translate-y-[calc(100%-17.5rem)]  py-2 text-4xl shadow-lg shadow-black/40"
                  />
                </div>
                <div className="flex items-stretch gap-2 overflow-visible opacity-90">
                <div className="flex min-h-0 min-w-0 flex-1 rotate-180">
                  <PlayerHand
                    className="min-h-0 w-full flex-1"
                    cards={visOppHand}
                    hideFaces
                    interactive={false}
                    onReleaseCards={() => undefined}
                  />
                </div>
                <div className="rotate-180">
                  <DeckPile
                    count={oppLibraryCount}
                    label="Opp library"
                    busy
                  />
                </div>
                <div className="rotate-180">
                  <TrashyardPile
                    cards={visOppTrash}
                    label="Opp trash"
                    onReleaseCard={() => undefined}
                  />
                </div>
                <div className="rotate-180">
                  <TrashyardPile
                    cards={visOppDismantled}
                    label="Opp dismantled"
                    onReleaseCard={() => undefined}
                  />
                </div>
                </div>
              </div>
            ) : null}

            {twoSeat ? (
              <div
                className="relative z-0 flex w-full shrink-0 items-stretch gap-1.5"
                style={{ height: STOCKPILE_HEIGHT.opponent }}
              >
                <div className="relative z-0 min-h-0 min-w-0 flex-1 self-stretch">
                  <p className="pointer-events-none absolute left-2 top-1 z-10 font-mono text-[10px] tracking-wide text-cyan-100/70">
                    Opp stockpile · {visOppStock.length}
                  </p>
                  <FreeFloatSurface
                    className="h-full min-h-0 w-full border-cyan-500/20 pt-3"
                    cards={visOppStock}
                    actions={READ_ONLY_FLOAT_ACTIONS}
                    interactive={false}
                  />
                </div>
              </div>
            ) : null}

            <div ref={surfaceRef} className="relative z-0 min-h-0 min-w-0 flex-1">
              <p className="pointer-events-none absolute bottom-1 left-2 z-10 font-mono text-[10px] tracking-wide text-cyan-100/70">
                Battlefield
              </p>
              <FreeFloatSurface
                className="h-full min-h-0 w-full border-cyan-500/20"
                cards={visBf}
                actions={floatSurfaceActions}
                onSelectionChange={(ids) =>
                  onFloatSelectionChange("battlefield", ids)
                }
                onCardsReleased={onBattlefieldRelease}
                onEmptyContextMenu={(x, y) =>
                  onZoneEmptyContextMenu("battlefield", x, y)
                }
              />
            </div>

            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize stockpile"
              title="Drag to resize battlefield / stockpile · double-click to reset"
              className="relative z-20 h-2 w-full shrink-0 cursor-row-resize touch-none"
              onPointerDown={onStockpileResizePointerDown}
              onPointerMove={onStockpileResizePointerMove}
              onPointerUp={onStockpileResizePointerUp}
              onPointerCancel={onStockpileResizePointerUp}
              onDoubleClick={() =>
                setStockpileHeightPx(STOCKPILE_HEIGHT.default)
              }
            >
              <div
                className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-cyan-500/35"
                aria-hidden
              />
            </div>

            <div
              className="relative z-0 flex w-full shrink-0 items-end gap-1.5"
              style={{ height: stockpileHeightPx, minHeight: STOCKPILE_HEIGHT.min }}
            >
              <div
                ref={stockpileRef}
                className="relative z-0 min-h-0 min-w-0 flex-1 self-stretch"
              >
                <p className="pointer-events-none absolute left-2 top-1 z-10 font-mono text-[10px] tracking-wide text-cyan-100/70">
                  Stockpile · {visStock.length}
                </p>
                <FreeFloatSurface
                  className="h-full min-h-0 w-full border-cyan-500/20 pt-3"
                  cards={visStock}
                  actions={floatSurfaceActions}
                  onSelectionChange={(ids) =>
                    onFloatSelectionChange("stockpile", ids)
                  }
                  onCardsReleased={onStockpileRelease}
                  onEmptyContextMenu={(x, y) =>
                    onZoneEmptyContextMenu("stockpile", x, y)
                  }
                />
              </div>
            </div>

            <div className="relative z-40 shrink-0 overflow-visible">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex -translate-y-[calc(100%+0.5rem)] justify-end pr-2">
                <LifeCounter
                  life={life}
                  onAdjust={(delta) =>
                    setLife((prev) => Math.max(0, prev + delta))
                  }
                  className="pointer-events-auto w-auto min-h-14 min-w-[4.5rem] px-4 py-2 text-4xl shadow-lg shadow-black/40"
                />
              </div>
              <div className="flex items-stretch gap-2 overflow-visible">
              <div ref={handRef} className="flex min-h-0 min-w-0 flex-1">
                <PlayerHand
                  className="min-h-0 w-full flex-1"
                  cards={visHand}
                  onReleaseCards={onHandRelease}
                  onCardContextMenu={onHandContextMenu}
                  onEmptyContextMenu={(x, y) =>
                    onZoneEmptyContextMenu("hand", x, y)
                  }
                  onSelectionChange={onHandSelectionChange}
                />
              </div>
              <DeckPile
                ref={deckRef}
                count={libraryCount}
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

      {status === "ready" ? (
        <>
          <PilotSidebar
            side="right"
            open={pilotSidebarOpen}
            onOpenChange={setPilotSidebarOpen}
            pilotRef={pilotRef}
            cards={visPilot}
            className="bottom-10"
            onReleaseCard={onFaceUpPileRelease}
            onCardContextMenu={onFloatCardContextMenu}
            onToggleExpended={(instanceId) => onToggleExpended([instanceId])}
            cardOverlay={pilotGenOverlay}
          />
          {twoSeat ? (
            <PilotSidebar
              side="left"
              open={oppPilotSidebarOpen}
              onOpenChange={setOppPilotSidebarOpen}
              cards={visOppPilot}
              readOnly
              pileLabel="Opp pilot"
              className="top-20"
              onReleaseCard={() => undefined}
            />
          ) : null}
        </>
      ) : null}

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
