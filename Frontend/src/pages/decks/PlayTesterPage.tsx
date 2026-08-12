/**
 * Playtester — battlefield + hand + library; drag cards between zones.
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets/shared"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { AccumulatePipChooser } from "@/components/Playtester/AccumulatePipChooser"
import {
  autoResolveColors,
  buildResourceTokenMap,
  canAutoResolvePips,
  extractGainablePips,
  spawnResourceTokenInstance,
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
  PILOT_GEN_MAX,
  PLAY_ZONE,
  PLAYTESTER_STORAGE,
  SELECTABLE_ACTION_ZONES,
  STOCKPILE_HEIGHT,
} from "@/components/Playtester/playtesterConstants"
import { useCardDragDrop } from "@/components/Playtester/useCardDragDrop"
import { useDrawAnimations } from "@/components/Playtester/useDrawAnimations"
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
  putTopLibraryOnBottom,
  reorderTopLibrary,
  shuffleLibrary,
} from "@/components/Playtester/deckActions.logic"
import { FreeFloatSurface } from "@/components/Playtester/FreeFloatSurface"
import { LifeCounter } from "@/components/Playtester/LifeCounter"
import { MulliganModal } from "@/components/Playtester/MulliganModal"
import { PlayerHand } from "@/components/Playtester/PlayerHand"
import { TrashyardPile } from "@/components/Playtester/TrashyardPile"
import {
  applyMulliganToBottom,
  setupOpeningSession,
  startingLifeFromPilot,
} from "@/components/Playtester/setupOpeningSession.logic"
import { pilotCard } from "@/components/decks/deck.logic"
import {
  cardsInZone,
  moveCardtoBack,
  moveCardtoFront,
  putCardsOnLibraryBottom,
  moveAllFromZone,
  removeCard,
  adjustCardCounter,
  duplicatePlayingCard,
  toggleExpended,
  setCardsFaceDown,
  readyBattlefieldAndStockpile,
  extractStockpileTimeCompletions,
  type CardCounterKind,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import { ContextMenu } from "@/components/ui/ContextMenu"
import {
  fetchCardLibrary,
  type CardLibraryItem,
} from "@/lib/api/cards"
import { cardArtUrl } from "@/lib/api/decks"
import { useDeckDetail } from "@/hooks/useDeckDetail"
import { ROUTES } from "@/lib/route"
import { GameIcon } from "@/components/common/GameIcon"

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
  const { deckId: deckIdParam } = useParams()
  const deckId = Number(deckIdParam)

  const { deck, status, errorText } = useDeckDetail(deckId, token)
  const [sessionCards, setSessionCards] = useState<PlayingCardInstance[]>([])
  const sessionCardsRef = useRef<PlayingCardInstance[]>([])
  sessionCardsRef.current = sessionCards
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
  /** Deck plays with its top card face up on the pile until turned off. */
  const [topRevealed, setTopRevealed] = useState(false)
  const [resourceTokens, setResourceTokens] = useState<CardLibraryItem[]>([])
  const [resourcesReady, setResourcesReady] = useState(false)
  const [playNotice, setPlayNotice] = useState<string | null>(null)
  const [life, setLife] = useState(0)
  const [turn, setTurn] = useState(1)
  /** Zone-persistent pilot invoke tax (+GEN). Survives pilot card swaps. */
  const [pilotGenBonus, setPilotGenBonus] = useState(0)
  const [pilotHandSize, setPilotHandSize] = useState(0)
  const [mulliganOpen, setMulliganOpen] = useState(false)
  const [stockpileHeightPx, setStockpileHeightPx] = useState<number>(
    STOCKPILE_HEIGHT.default
  )
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
  } = useDrawAnimations({
    sessionCardsRef,
    setSessionCards,
    zoneRefs,
    clientToSurfaceLocal,
    clientToStockpileLocal,
    mulliganOpen,
  })

  const {
    onHandRelease,
    onBattlefieldRelease,
    onStockpileRelease,
    onFaceUpPileRelease,
    onLibraryCardRelease,
  } = useCardDragDrop({
    sessionCards,
    setSessionCards,
    zoneRefs,
    clientToSurfaceLocal,
    clientToStockpileLocal,
    isFlipFlying,
    pushFlipAnim,
  })

  useEffect(() => {
    setStockpileHeightPx(readStoredStockpileHeight())
  }, [])

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
    if (status !== "ready" || !deck) {
      setSessionCards([])
      setLife(0)
      setTurn(1)
      setPilotGenBonus(0)
      setPilotHandSize(0)
      setMulliganOpen(false)
      setTopRevealed(false)
      clearDrawTimers()
      return
    }
    if (!resourcesReady) return

    const opening = setupOpeningSession(deck, resourceByColor)
    const pilot = pilotCard(deck.cards, deck.categories)
    sessionCardsRef.current = opening
    setSessionCards(opening)
    setLife(startingLifeFromPilot(pilot))
    setTurn(1)
    setPilotGenBonus(0)
    setPilotHandSize(Math.max(0, Math.floor(pilot?.hand_size ?? 0)))
    setMulliganOpen(cardsInZone(opening, "hand").length > 0)
    setTopRevealed(false)
  }, [status, deck, resourcesReady, resourceByColor])

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
  }, [status, mulliganOpen, accumulateChooser, inspectCard, deckPeek, deckSearchOpen])

  const handCards = cardsInZone(sessionCards, PLAY_ZONE.hand)
  const battlefieldCards = cardsInZone(sessionCards, PLAY_ZONE.battlefield)
  const stockpileCards = cardsInZone(sessionCards, PLAY_ZONE.stockpile)
  const pilotCards = cardsInZone(sessionCards, PLAY_ZONE.pilot)
  const libraryCount = cardsInZone(sessionCards, PLAY_ZONE.library).length
  const topLibraryCard = topRevealed
    ? (peekTopLibrary(sessionCards, 1)[0] ?? null)
    : null
  const trashCards = cardsInZone(sessionCards, PLAY_ZONE.trashyard)
  const dismantledCards = cardsInZone(sessionCards, PLAY_ZONE.dismantled)

  function onMoveCards(
    moves: { instanceId: string; x: number; y: number }[]
  ) {
    if (moves.length === 0) return
    const byId = new Map(moves.map((m) => [m.instanceId, m]))
    setSessionCards((prev) =>
      prev.map((card) => {
        const move = byId.get(card.instanceId)
        return move ? { ...card, x: move.x, y: move.y } : card
      })
    )
  }

  function onBringToFront(instanceId: string) {
    setSessionCards((prev) => moveCardtoFront(prev, instanceId))
  }

  function onSendToBack(instanceId: string) {
    setSessionCards((prev) => moveCardtoBack(prev, instanceId))
  }

  function onToggleExpended(instanceIds: string[]) {
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        next = toggleExpended(next, id)
      }
      return next
    })
  }

  /** Marquee selection on a free-float zone. */
  function onFloatSelectionChange(
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

  /** Click / marquee selection on the hand strip. */
  function onHandSelectionChange(instanceIds: string[]) {
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
    sessionCardsRef.current = cards
    setSessionCards(cards)
    queueStockpileTimeCompletions(launching)
  }

  function onStartTurn() {
    if (mulliganOpen || bottomAnim) return
    const before = sessionCardsRef.current
    commitWithStockpileTimeCompletions(
      before,
      readyBattlefieldAndStockpile(before)
    )
  }

  /**
   * End turn: draw up to pilot hand_size − 2, then advance the turn clock.
   * Each card you cannot draw from an empty library costs 1 life.
   */
  function onEndTurn() {
    if (mulliganOpen || bottomAnim) return
    if (hasPendingDrawTimers()) return

    const targetHand = Math.max(0, pilotHandSize - 2)
    const handCount = cardsInZone(sessionCardsRef.current, PLAY_ZONE.hand).length
    const need = Math.max(0, targetHand - handCount)

    if (need > 0) {
      const libraryCount = cardsInZone(sessionCardsRef.current, PLAY_ZONE.library).length
      const drawCount = Math.min(need, libraryCount)
      const lifeLoss = need - drawCount
      if (lifeLoss > 0) {
        setLife((prev) => Math.max(0, prev - lifeLoss))
      }
      if (drawCount > 0) queueDrawsToHand(drawCount)
    }

    setTurn((prev) => prev + 1)
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
    setSessionCards((prev) => {
      let next = removeCard(prev, card.instanceId)
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

  /** Remove cards from the session (cheat / cleanup — not trashyard). */
  function deleteSessionCards(instanceIds: string[]) {
    if (instanceIds.length === 0) return
    const ids = new Set(instanceIds)
    setSessionCards((prev) => {
      const next = prev.filter((c) => !ids.has(c.instanceId))
      sessionCardsRef.current = next
      return next
    })
  }

  function onFloatCardCounterAdjust(
    instanceId: string,
    kind: CardCounterKind,
    delta: number
  ) {
    adjustCardCounters([instanceId], kind, delta)
  }

  function adjustCardCounters(
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
    sessionCardsRef.current = after
    setSessionCards(after)
  }

  /** Cheat / helper: spawn one resource token onto the stockpile. */
  function spawnResourceColor(color: ResourceColor) {
    const template = resourceByColor.get(color)
    if (!template) {
      setPlayNotice(`No catalog card loaded for ${color}.`)
      return
    }
    setSessionCards((prev) => {
      const seq = cardsInZone(prev, PLAY_ZONE.stockpile).length
      const next = [
        ...prev,
        spawnResourceTokenInstance(
          template,
          20 + (seq % 8) * 28,
          24 + Math.floor(seq / 8) * 16,
          seq
        ),
      ]
      sessionCardsRef.current = next
      return next
    })
  }

  function adjustPilotGenBonus(delta: number) {
    setPilotGenBonus((prev) =>
      Math.max(0, Math.min(PILOT_GEN_MAX, prev + delta))
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
    const peeked = peekTopLibrary(sessionCardsRef.current, n)
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
    setSessionCards((prev) => {
      const next = putTopLibraryOnBottom(prev, n)
      sessionCardsRef.current = next
      return next
    })
    queueTuckUnderDeck(n)
    setPlayNotice(
      n === 1
        ? "Top card put on the bottom."
        : `Top ${n} cards put on the bottom.`
    )
  }

  function shuffleLibraryNow(notice: string) {
    setSessionCards((prev) => {
      const next = shuffleLibrary(prev)
      sessionCardsRef.current = next
      return next
    })
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
    setSessionCards((prev) => {
      const next = reorderTopLibrary(
        prev,
        orderedCards.map((c) => c.instanceId)
      )
      sessionCardsRef.current = next
      return next
    })
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
    actions: {
      spawnResourceColor,
      putOnLibraryBottom: (instanceIds) => {
        setSessionCards((prev) => {
          const next = putCardsOnLibraryBottom(prev, instanceIds)
          sessionCardsRef.current = next
          return next
        })
      },
      setFaceDown: (instanceIds, faceDown) => {
        setSessionCards((prev) => setCardsFaceDown(prev, instanceIds, faceDown))
      },
      deleteSessionCards,
      startAccumulate,
      adjustCounter: (instanceIds, kind, delta) => {
        adjustCardCounters(instanceIds, kind, delta)
      },
      duplicateCard: (instanceId) => {
        setSessionCards((prev) => duplicatePlayingCard(prev, instanceId))
      },
      inspectCard: (card) => setInspectCard(card),
      adjustPilotGenBonus,
      toggleExpended: onToggleExpended,
      degradeDeck,
      lookAtDeckTop,
      putDeckTopOnBottom,
      shuffleDeck,
      toggleDeckTopRevealed,
      openDeckSearch,
      moveAllFromZone: (from, to) => {
        setSessionCards((prev) => {
          const next = moveAllFromZone(prev, from, to)
          sessionCardsRef.current = next
          return next
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

      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-start justify-between gap-2 p-2">
        <div className="pointer-events-auto">
          <GlitchFx
            type="button"
            label="← BACK TO DECK"
            className="font-buahs93 h-7 rounded-none bg-cyan-700 px-3 text-xs hover:bg-cyan-900"
            onClick={() => {
              if (Number.isFinite(deckId) && deckId > 0) {
                // Replace so browser Back from the deck does not reopen playtester.
                navigate(ROUTES.deck(deckId), { replace: true })
                return
              }
              navigate(ROUTES.MAIN)
            }}
          />
        </div>

        {playNotice ? (
          <p
            className="max-w-[45%] text-right font-mono text-xs text-amber-200/90"
            role="status"
          >
            {playNotice}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-2">
        {status === "error" ? (
          <p className="mt-7 font-mono text-sm text-red-400" role="alert">
            {errorText}
          </p>
        ) : null}

        {status === "ready" ? (
          <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-1">
            <div ref={surfaceRef} className="relative z-0 min-h-0 min-w-0 flex-1">
              <p className="pointer-events-none absolute bottom-1 left-2 z-10 font-mono text-[10px] tracking-wide text-cyan-100/70">
                Battlefield
              </p>
              <FreeFloatSurface
                className="h-full min-h-0 w-full border-cyan-500/20"
                cards={battlefieldCards}
                onMoveCards={onMoveCards}
                onBringToFront={onBringToFront}
                onSendToBack={onSendToBack}
                onToggleExpended={onToggleExpended}
                onSelectionChange={(ids) =>
                  onFloatSelectionChange("battlefield", ids)
                }
                onCardsReleased={onBattlefieldRelease}
                onCardContextMenu={onFloatCardContextMenu}
                onEmptyContextMenu={(x, y) =>
                  onZoneEmptyContextMenu("battlefield", x, y)
                }
                onCardCounterAdjust={onFloatCardCounterAdjust}
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
                  Stockpile · {stockpileCards.length}
                </p>
                <FreeFloatSurface
                  className="h-full min-h-0 w-full border-cyan-500/20 pt-3"
                  cards={stockpileCards}
                  onMoveCards={onMoveCards}
                  onBringToFront={onBringToFront}
                  onSendToBack={onSendToBack}
                  onToggleExpended={onToggleExpended}
                  onSelectionChange={(ids) =>
                    onFloatSelectionChange("stockpile", ids)
                  }
                  onCardsReleased={onStockpileRelease}
                  onCardContextMenu={onFloatCardContextMenu}
                  onEmptyContextMenu={(x, y) =>
                    onZoneEmptyContextMenu("stockpile", x, y)
                  }
                  onCardCounterAdjust={onFloatCardCounterAdjust}
                />
              </div>

              <div className="flex w-[8.25rem] shrink-0 flex-col items-center gap-1 self-end">
                <LifeCounter
                  life={life}
                  onAdjust={(delta) =>
                    setLife((prev) => Math.max(0, prev + delta))
                  }
                />
                <TrashyardPile
                  ref={pilotRef}
                  cards={pilotCards}
                  label="Pilot"
                  size="lg"
                  onReleaseCard={onFaceUpPileRelease}
                  onCardContextMenu={onFloatCardContextMenu}
                  onToggleExpended={(instanceId) =>
                    onToggleExpended([instanceId])
                  }
                  cardOverlay={
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
                          } else if (
                            event.key === "-" ||
                            event.key === "Backspace"
                          ) {
                            event.preventDefault()
                            adjustPilotGenBonus(-1)
                          }
                        }}
                      >
                        +
                        <GameIcon
                          name={genIconForCount(pilotGenBonus)}
                          className="h-5 w-auto"
                        />
                      </span>
                    ) : null
                  }
                />
              </div>
            </div>

            <div className="relative z-40 flex shrink-0 items-stretch gap-2 overflow-visible">
              <div ref={handRef} className="flex min-h-0 min-w-0 flex-1">
                <PlayerHand
                  className="min-h-0 w-full flex-1"
                  cards={handCards}
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
                cards={trashCards}
                label="Trashyard"
                onReleaseCard={onFaceUpPileRelease}
                onCardContextMenu={onFloatCardContextMenu}
                onPileContextMenu={(x, y) =>
                  onFaceUpPileContextMenu(PLAY_ZONE.trashyard, x, y)
                }
              />
              <TrashyardPile
                ref={dismantledRef}
                cards={dismantledCards}
                label="Dismantled"
                onReleaseCard={onFaceUpPileRelease}
                onCardContextMenu={onFloatCardContextMenu}
                onPileContextMenu={(x, y) =>
                  onFaceUpPileContextMenu(PLAY_ZONE.dismantled, x, y)
                }
              />
            </div>

            <div className="relative z-40 flex shrink-0 items-center gap-2 border-t border-cyan-500/25 bg-black/55 px-2 py-1.5">
              <GlitchFx
                type="button"
                label="START TURN"
                disabled={mulliganOpen || Boolean(bottomAnim)}
                className="font-buahs93 h-7 rounded-none bg-cyan-700 px-3 text-xs hover:bg-cyan-900 disabled:opacity-40"
                onClick={onStartTurn}
              />
              <GlitchFx
                type="button"
                label="END TURN"
                disabled={mulliganOpen || Boolean(bottomAnim)}
                className="font-buahs93 h-7 rounded-none bg-cyan-700 px-3 text-xs hover:bg-cyan-900 disabled:opacity-40"
                onClick={onEndTurn}
              />
              <span
                className="ml-auto font-buahs93 text-sm tracking-wide text-cyan-100/90"
                aria-live="polite"
              >
                Turn {turn}
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

      {mulliganOpen ? (
        <MulliganModal
          hand={handCards}
          onConfirm={(selectedIds) => {
            const result = applyMulliganToBottom(
              sessionCardsRef.current,
              selectedIds
            )
            sessionCardsRef.current = result.cards
            setSessionCards(result.cards)
            setMulliganOpen(false)
            queueDrawsToHand(result.drawCount)
          }}
        />
      ) : null}

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
        onCancel={closeDeckSearch}
        onCardRelease={onLibraryCardRelease}
        onCardContextMenu={onFloatCardContextMenu}
      />
    </section>
  )
}
