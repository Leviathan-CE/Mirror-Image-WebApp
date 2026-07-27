/**
 * Playtester — battlefield + hand + library; drag cards between zones.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/app/providers/AuthProvider"
import { sharedImages } from "@/assets/shared"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { AccumulatePipChooser } from "@/components/Playtester/AccumulatePipChooser"
import {
  autoResolveColors,
  allResourceTokenSearchNames,
  buildResourceTokenMap,
  canAutoResolvePips,
  extractGainablePips,
  spawnResourceTokenInstance,
  RESOURCE_COLORS,
  type GainablePip,
  type ResourceColor,
} from "@/components/Playtester/accumulateResources"
import { CardBottomSlideAnimation } from "@/components/Playtester/CardBottomSlideAnimation"
import {
  CardFlipFlyAnimation,
  type FlipFlyMode,
} from "@/components/Playtester/CardFlipFlyAnimation"
import { DeckPile } from "@/components/Playtester/DeckPile"
import { FreeFloatSurface } from "@/components/Playtester/FreeFloatSurface"
import { LifeCounter } from "@/components/Playtester/LifeCounter"
import { MulliganModal } from "@/components/Playtester/MulliganModal"
import { PlayerHand } from "@/components/Playtester/PlayerHand"
import { TrashyardPile } from "@/components/Playtester/TrashyardPile"
import {
  applyMulliganToBottom,
  setupOpeningSession,
  startingLifeFromPilot,
} from "@/components/Playtester/setupOpeningSession"
import { pilotCard } from "@/components/decks/deckLogic"
import {
  cardsInZone,
  moveCardtoBack,
  moveCardtoFront,
  moveToBattlefield,
  moveToHand,
  moveToTrashyard,
  moveToDismantled,
  moveToStockpile,
  moveToPilot,
  putCardInHand,
  putCardInTrashyard,
  putCardInDismantled,
  putCardOnBattlefield,
  putCardOnStockpile,
  putCardOnPilot,
  putCardOnLibraryTop,
  putCardOnLibraryBottom,
  putCardsOnLibraryBottom,
  removeCard,
  isResourceTokenInstance,
  adjustCardCounter,
  duplicatePlayingCard,
  takeTopLibraryCard,
  toggleExpended,
  readyBattlefieldAndStockpile,
  type PlayingCardInstance,
} from "@/components/Playtester/types"
import { ContextMenu } from "@/components/ui/ContextMenu"
import type { DropdownMenuItem } from "@/components/ui/DropdownMenu"
import {
  fetchCardLibrary,
  type CardLibraryItem,
} from "@/lib/api/cards"
import { useDeckDetail } from "@/hooks/useDeckDetail"
import { ROUTES } from "@/lib/route"
import { GameIcon } from "@/components/common/GameIcon"
import type { GameIconName } from "@/components/common/GameIcon"

/** Cost colour → GameIcon asset name. */
const RESOURCE_COLOR_ICON: Record<ResourceColor, GameIconName> = {
  LIF: "life",
  MET: "metal",
  POW: "power",
  RAM: "ram",
  TIM: "time",
  STL: "steel",
}

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

type FlipLandZone =
  | "hand"
  | "battlefield"
  | "stockpile"
  | "pilot"
  | "trashyard"
  | "dismantled"
  | "library"

type FlipFlyAnim = {
  /** Stable key so several flips can fly at once. */
  id: string
  card: PlayingCardInstance
  mode: FlipFlyMode
  from: { x: number; y: number; w: number; h: number }
  to: { x: number; y: number }
  /** Where the card sits when the fly finishes. */
  landZone: FlipLandZone
  landX?: number
  landY?: number
}

type BottomSlideAnim = {
  card: PlayingCardInstance
  from: { x: number; y: number; w: number; h: number }
  to: { x: number; y: number }
}

type CtxMenuState = {
  instanceId: string
  x: number
  y: number
}

type AccumulateChooserState = {
  card: PlayingCardInstance
  pips: GainablePip[]
  from: { x: number; y: number; w: number; h: number }
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
  const [flipAnims, setFlipAnims] = useState<FlipFlyAnim[]>([])
  const flipAnimsRef = useRef<FlipFlyAnim[]>([])
  flipAnimsRef.current = flipAnims
  const flipAnimIdRef = useRef(0)

  const [bottomAnim, setBottomAnim] = useState<BottomSlideAnim | null>(null)
  const bottomAnimRef = useRef<BottomSlideAnim | null>(null)
  bottomAnimRef.current = bottomAnim

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)
  const [accumulateChooser, setAccumulateChooser] =
    useState<AccumulateChooserState | null>(null)
  const [resourceTokens, setResourceTokens] = useState<CardLibraryItem[]>([])
  const [resourcesReady, setResourcesReady] = useState(false)
  const [playNotice, setPlayNotice] = useState<string | null>(null)
  const [life, setLife] = useState(0)
  const [turn, setTurn] = useState(1)
  const [pilotHandSize, setPilotHandSize] = useState(0)
  const [mulliganOpen, setMulliganOpen] = useState(false)
  /** Timers for staggered concurrent mulligan draws. */
  const mulliganTimersRef = useRef<number[]>([])
  /** Spreads rapid click-draws so overlapping flies don't stack on one pixel. */
  const drawBurstOffsetRef = useRef(0)
  /** Shared deck→hand path for a burst of click-draws. */
  const clickDrawRouteRef = useRef<{
    from: { x: number; y: number; w: number; h: number }
    to: { x: number; y: number }
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

  useEffect(() => {
    if (status !== "ready" || !deck) {
      setSessionCards([])
      setLife(0)
      setTurn(1)
      setPilotHandSize(0)
      setMulliganOpen(false)
      for (const t of mulliganTimersRef.current) window.clearTimeout(t)
      mulliganTimersRef.current = []
      return
    }
    if (!resourcesReady) return

    const opening = setupOpeningSession(deck, resourceByColor)
    const pilot = pilotCard(deck.cards, deck.categories)
    sessionCardsRef.current = opening
    setSessionCards(opening)
    setLife(startingLifeFromPilot(pilot))
    setTurn(1)
    setPilotHandSize(Math.max(0, Math.floor(pilot?.hand_size ?? 0)))
    setMulliganOpen(cardsInZone(opening, "hand").length > 0)
  }, [status, deck, resourcesReady, resourceByColor])

  useEffect(() => {
    if (status !== "ready") {
      setResourceTokens([])
      setResourcesReady(false)
      return
    }
    let cancelled = false
    setResourcesReady(false)
    const names = allResourceTokenSearchNames()

    // Preload the six resource token cards by name (Unit of Power, R.A.M, …),
    // plus Resource/Token super-type scans as backup.
    void Promise.all([
      ...names.map((q) =>
        fetchCardLibrary({ q, limit: 12, offset: 0 }, token)
      ),
      fetchCardLibrary({ superType: "Resource", limit: 100, offset: 0 }, token),
      fetchCardLibrary({ superType: "Token", limit: 100, offset: 0 }, token),
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

  const handCards = cardsInZone(sessionCards, "hand")
  const battlefieldCards = cardsInZone(sessionCards, "battlefield")
  const stockpileCards = cardsInZone(sessionCards, "stockpile")
  const pilotCards = cardsInZone(sessionCards, "pilot")
  const libraryCount = cardsInZone(sessionCards, "library").length
  const trashCards = cardsInZone(sessionCards, "trashyard")
  const dismantledCards = cardsInZone(sessionCards, "dismantled")

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

  function clearFloatSelection(cards: PlayingCardInstance[]) {
    return cards.map((c) =>
      (c.zone === "battlefield" || c.zone === "stockpile") && c.selected
        ? { ...c, selected: false }
        : c
    )
  }

  /**
   * Drop onto deck → face→back onto library top.
   * One card keeps the flip anim; a group is placed instantly.
   */
  function tryPutGroupOnDeck(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (flipAnimsRef.current.length > 0) return false
    const deckEl = deckRef.current
    if (!deckEl || !pointInRect(clientX, clientY, deckEl)) return false

    const movable = instanceIds
      .map((id) => sessionCards.find((c) => c.instanceId === id))
      .filter(
        (c): c is PlayingCardInstance => Boolean(c && c.zone !== "library")
      )
    if (movable.length === 0) return false

    // Resource tokens never enter the library — they leave play.
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
        mode: "put",
        from: {
          x: clientX - w / 2,
          y: clientY - h / 2,
          w,
          h,
        },
        to: { x: deckRect.left, y: deckRect.top },
        landZone: "library",
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

  /** Drop onto trashyard (face-up, no flip). */
  function tryPutGroupOnTrashyard(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, trashRef.current)) return false
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        const card = next.find((c) => c.instanceId === id)
        if (!card || card.zone === "trashyard") continue
        next = moveToTrashyard(next, id)
      }
      return clearFloatSelection(next)
    })
    return true
  }

  /** Drop onto dismantled (face-up, no flip). */
  function tryPutGroupOnDismantled(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, dismantledRef.current)) return false
    setSessionCards((prev) => {
      let next = prev
      for (const id of instanceIds) {
        const card = next.find((c) => c.instanceId === id)
        if (!card || card.zone === "dismantled") continue
        next = moveToDismantled(next, id)
      }
      return clearFloatSelection(next)
    })
    return true
  }

  /** Drop onto stockpile free-float zone. */
  function tryPutGroupOnStockpile(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, stockpileRef.current)) return false
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

  /**
   * Drop onto pilot slot (capacity 1). Only the first card of a group seats;
   * an existing pilot is bumped to hand inside moveToPilot.
   */
  function tryPutGroupOnPilot(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ): boolean {
    if (!pointInRect(clientX, clientY, pilotRef.current)) return false
    const id = instanceIds[0]
    if (!id) return false
    setSessionCards((prev) => clearFloatSelection(moveToPilot(prev, id)))
    return true
  }

  /** Hand release: deck → trash → dismantled → pilot → stockpile → battlefield. */
  function onHandRelease(
    instanceId: string,
    clientX: number,
    clientY: number
  ) {
    if (tryPutGroupOnDeck([instanceId], clientX, clientY)) return
    if (tryPutGroupOnTrashyard([instanceId], clientX, clientY)) return
    if (tryPutGroupOnDismantled([instanceId], clientX, clientY)) return
    if (tryPutGroupOnPilot([instanceId], clientX, clientY)) return
    if (tryPutGroupOnStockpile([instanceId], clientX, clientY)) return
    if (!pointInRect(clientX, clientY, surfaceRef.current)) return
    const { x, y } = clientToSurfaceLocal(clientX, clientY)
    setSessionCards((prev) =>
      moveCardtoFront(moveToBattlefield(prev, instanceId, x, y), instanceId)
    )
  }

  /** Battlefield release: deck → trash → dismantled → pilot → stockpile → hand. */
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
    if (pointInRect(clientX, clientY, handRef.current)) {
      setSessionCards((prev) => {
        let next = prev
        for (const id of instanceIds) {
          next = moveToHand(next, id)
        }
        return clearFloatSelection(next)
      })
    }
  }

  /** Stockpile release: deck → trash → dismantled → pilot → hand → battlefield. */
  function onStockpileRelease(
    instanceIds: string[],
    clientX: number,
    clientY: number
  ) {
    if (tryPutGroupOnDeck(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnTrashyard(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnDismantled(instanceIds, clientX, clientY)) return
    if (tryPutGroupOnPilot(instanceIds, clientX, clientY)) return
    if (pointInRect(clientX, clientY, handRef.current)) {
      setSessionCards((prev) => {
        let next = prev
        for (const id of instanceIds) {
          next = moveToHand(next, id)
        }
        return clearFloatSelection(next)
      })
      return
    }
    if (pointInRect(clientX, clientY, surfaceRef.current)) {
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

  /** Shared release from trashyard, dismantled, or pilot slot. */
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
    if (pointInRect(clientX, clientY, handRef.current)) {
      setSessionCards((prev) => moveToHand(prev, instanceId))
      return
    }
    if (pointInRect(clientX, clientY, surfaceRef.current)) {
      const { x, y } = clientToSurfaceLocal(clientX, clientY)
      setSessionCards((prev) =>
        moveCardtoFront(moveToBattlefield(prev, instanceId, x, y), instanceId)
      )
    }
  }

  /** Click deck (no drag): draw top card with back→face flip into hand. */
  function pushFlipAnim(anim: Omit<FlipFlyAnim, "id">): string {
    flipAnimIdRef.current += 1
    const id = `flip-${flipAnimIdRef.current}`
    const next: FlipFlyAnim = { ...anim, id }
    const list = [...flipAnimsRef.current, next]
    flipAnimsRef.current = list
    setFlipAnims(list)
    return id
  }

  function beginDrawToHand(options?: {
    /** Allow overlapping flips (mulligan burst). */
    concurrent?: boolean
    /** Slight hand landing offset so stacked flies stay readable. */
    landOffsetIndex?: number
    /**
     * Frozen screen positions for a burst of draws. Without this, each staggered
     * start re-measures the hand — and as earlier cards land, hand height/center
     * shifts so later flies aim higher or lower (looks like random up/down).
     */
    frozenRoute?: {
      from: { x: number; y: number; w: number; h: number }
      to: { x: number; y: number }
    }
  }): boolean {
    if (!options?.concurrent && flipAnimsRef.current.length > 0) return false

    const deckEl = deckRef.current
    const handEl = handRef.current
    if (!deckEl || !handEl) return false

    const taken = takeTopLibraryCard(sessionCardsRef.current)
    if (!taken) return false

    const offset = (options?.landOffsetIndex ?? 0) * 18
    let from: { x: number; y: number; w: number; h: number }
    let to: { x: number; y: number }

    if (options?.frozenRoute) {
      from = options.frozenRoute.from
      to = {
        x: options.frozenRoute.to.x - offset,
        y: options.frozenRoute.to.y,
      }
    } else {
      const deckRect = deckEl.getBoundingClientRect()
      const handRect = handEl.getBoundingClientRect()
      const cardW = deckRect.width
      const cardH = deckRect.height
      from = {
        x: deckRect.left,
        y: deckRect.top,
        w: cardW,
        h: cardH,
      }
      to = {
        x: handRect.right - cardW - 12 - offset,
        y: handRect.top + (handRect.height - cardH) / 2,
      }
    }

    sessionCardsRef.current = taken.cards
    setSessionCards(taken.cards)
    pushFlipAnim({
      card: taken.drawn,
      mode: "draw",
      from,
      to,
      landZone: "hand",
    })
    return true
  }

  function onDrawFromDeck() {
    if (mulliganOpen || mulliganTimersRef.current.length > 0) return

    const deckEl = deckRef.current
    const handEl = handRef.current
    if (!deckEl || !handEl) return

    if (!clickDrawRouteRef.current) {
      const deckRect = deckEl.getBoundingClientRect()
      const handRect = handEl.getBoundingClientRect()
      const cardW = deckRect.width
      const cardH = deckRect.height
      clickDrawRouteRef.current = {
        from: {
          x: deckRect.left,
          y: deckRect.top,
          w: cardW,
          h: cardH,
        },
        to: {
          x: handRect.right - cardW - 12,
          y: handRect.top + (handRect.height - cardH) / 2,
        },
      }
      drawBurstOffsetRef.current = 0
    }

    const landOffsetIndex = drawBurstOffsetRef.current
    drawBurstOffsetRef.current += 1
    beginDrawToHand({
      concurrent: true,
      landOffsetIndex,
      frozenRoute: clickDrawRouteRef.current,
    })
  }

  /** Fire replacement draws in quick succession — flips overlap in flight. */
  function queueDrawsToHand(count: number) {
    for (const t of mulliganTimersRef.current) window.clearTimeout(t)
    mulliganTimersRef.current = []
    if (count <= 0) return

    const deckEl = deckRef.current
    const handEl = handRef.current
    if (!deckEl || !handEl) return

    // One shared flight path for the whole burst (Y stays identical).
    const deckRect = deckEl.getBoundingClientRect()
    const handRect = handEl.getBoundingClientRect()
    const cardW = deckRect.width
    const cardH = deckRect.height
    const frozenRoute = {
      from: {
        x: deckRect.left,
        y: deckRect.top,
        w: cardW,
        h: cardH,
      },
      to: {
        x: handRect.right - cardW - 12,
        y: handRect.top + (handRect.height - cardH) / 2,
      },
    }

    const STAGGER_MS = 300
    for (let i = 0; i < count; i++) {
      const landOffsetIndex = i
      const timer = window.setTimeout(() => {
        beginDrawToHand({
          concurrent: true,
          landOffsetIndex,
          frozenRoute,
        })
        mulliganTimersRef.current = mulliganTimersRef.current.filter(
          (id) => id !== timer
        )
      }, i * STAGGER_MS)
      mulliganTimersRef.current.push(timer)
    }
  }

  /** Start turn: ready BF + stockpile, tick time counters down by 1. */
  function onStartTurn() {
    if (mulliganOpen || bottomAnim) return
    setSessionCards((prev) => {
      const next = readyBattlefieldAndStockpile(prev)
      sessionCardsRef.current = next
      return next
    })
  }

  /**
   * End turn: draw up to pilot hand_size − 2, then advance the turn clock.
   * Each card you cannot draw from an empty library costs 1 life.
   */
  function onEndTurn() {
    if (mulliganOpen || bottomAnim) return
    if (mulliganTimersRef.current.length > 0) return

    const targetHand = Math.max(0, pilotHandSize - 2)
    const handCount = cardsInZone(sessionCardsRef.current, "hand").length
    const need = Math.max(0, targetHand - handCount)

    if (need > 0) {
      const libraryCount = cardsInZone(sessionCardsRef.current, "library").length
      const drawCount = Math.min(need, libraryCount)
      const lifeLoss = need - drawCount
      if (lifeLoss > 0) {
        setLife((prev) => Math.max(0, prev - lifeLoss))
      }
      if (drawCount > 0) queueDrawsToHand(drawCount)
    }

    setTurn((prev) => prev + 1)
  }

  /**
   * Drag top library card onto a zone → back→face flip into that zone.
   * Dropping back on the deck (or nowhere valid) cancels.
   */
  function onDeckTopRelease(clientX: number, clientY: number) {
    if (flipAnimsRef.current.length > 0) return

    const deckEl = deckRef.current
    if (!deckEl) return
    if (pointInRect(clientX, clientY, deckEl)) return

    const deckRect = deckEl.getBoundingClientRect()
    const w = deckRect.width
    const h = deckRect.height

    let landZone: FlipLandZone | null = null
    let to = { x: clientX - w / 2, y: clientY - h / 2 }
    let landX: number | undefined
    let landY: number | undefined

    if (pointInRect(clientX, clientY, handRef.current)) {
      landZone = "hand"
      const handRect = handRef.current!.getBoundingClientRect()
      to = {
        x: handRect.right - w - 12,
        y: handRect.top + (handRect.height - h) / 2,
      }
    } else if (pointInRect(clientX, clientY, trashRef.current)) {
      landZone = "trashyard"
      const trashRect = trashRef.current!.getBoundingClientRect()
      to = { x: trashRect.left, y: trashRect.top }
    } else if (pointInRect(clientX, clientY, dismantledRef.current)) {
      landZone = "dismantled"
      const dismantledRect = dismantledRef.current!.getBoundingClientRect()
      to = { x: dismantledRect.left, y: dismantledRect.top }
    } else if (pointInRect(clientX, clientY, stockpileRef.current)) {
      landZone = "stockpile"
      const local = clientToStockpileLocal(clientX, clientY)
      landX = local.x
      landY = local.y
      to = { x: clientX - w / 2, y: clientY - h / 2 }
    } else if (pointInRect(clientX, clientY, pilotRef.current)) {
      landZone = "pilot"
      const pilotRect = pilotRef.current!.getBoundingClientRect()
      to = { x: pilotRect.left, y: pilotRect.top }
    } else if (pointInRect(clientX, clientY, surfaceRef.current)) {
      landZone = "battlefield"
      const local = clientToSurfaceLocal(clientX, clientY)
      landX = local.x
      landY = local.y
      to = { x: clientX - w / 2, y: clientY - h / 2 }
    }

    if (!landZone) return

    const taken = takeTopLibraryCard(sessionCardsRef.current)
    if (!taken) return

    sessionCardsRef.current = taken.cards
    setSessionCards(taken.cards)
    pushFlipAnim({
      card: taken.drawn,
      mode: "draw",
      from: {
        x: clientX - w / 2,
        y: clientY - h / 2,
        w,
        h,
      },
      to,
      landZone,
      landX,
      landY,
    })
  }

  function onFlipAnimComplete(animId: string) {
    const current = flipAnimsRef.current.find((a) => a.id === animId)
    const remaining = flipAnimsRef.current.filter((a) => a.id !== animId)
    flipAnimsRef.current = remaining
    setFlipAnims(remaining)
    if (remaining.length === 0) {
      drawBurstOffsetRef.current = 0
      clickDrawRouteRef.current = null
    }
    if (!current) return

    if (current.landZone === "library" || current.mode === "put") {
      const next = putCardOnLibraryTop(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === "hand") {
      const next = putCardInHand(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === "trashyard") {
      const next = putCardInTrashyard(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === "dismantled") {
      const next = putCardInDismantled(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === "stockpile") {
      const next = putCardOnStockpile(
        sessionCardsRef.current,
        current.card,
        current.landX ?? 24,
        current.landY ?? 24
      )
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === "pilot") {
      const next = putCardOnPilot(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === "battlefield") {
      const next = putCardOnBattlefield(
        sessionCardsRef.current,
        current.card,
        current.landX ?? 24,
        current.landY ?? 48
      )
      sessionCardsRef.current = next
      setSessionCards(next)
    }
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
    const deckEl = deckRef.current
    const deckRect = deckEl?.getBoundingClientRect()
    const to = deckRect
      ? { x: deckRect.left, y: deckRect.top }
      : { x: from.x, y: from.y - 80 }

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

    setBottomAnim({
      card,
      from,
      to,
    })
  }

  function startAccumulate(instanceId: string) {
    setCtxMenu(null)
    if (flipAnims.length > 0 || bottomAnim) return

    const card = sessionCards.find(
      (c) => c.instanceId === instanceId && c.zone === "hand"
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
    setCtxMenu({ instanceId, x: clientX, y: clientY })
  }

  function onFloatCardContextMenu(
    instanceId: string,
    clientX: number,
    clientY: number
  ) {
    setPlayNotice(null)
    setCtxMenu({ instanceId, x: clientX, y: clientY })
  }

  function onFloatCardCounterAdjust(
    instanceId: string,
    kind: "time" | "damage" | "tlv",
    delta: number
  ) {
    setSessionCards((prev) => adjustCardCounter(prev, instanceId, kind, delta))
  }

  /** Cheat / helper: spawn one resource token onto the stockpile. */
  function spawnResourceColor(color: ResourceColor) {
    const template = resourceByColor.get(color)
    if (!template) {
      setPlayNotice(`No catalog card loaded for ${color}.`)
      return
    }
    setSessionCards((prev) => {
      const seq = cardsInZone(prev, "stockpile").length
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

  const ctxMenuItems: DropdownMenuItem[] = (() => {
    if (!ctxMenu) return []
    const card = sessionCards.find((c) => c.instanceId === ctxMenu.instanceId)
    if (!card || card.zone === "library") return []

    const putBottomTargets = (() => {
      if (
        (card.zone === "battlefield" || card.zone === "stockpile") &&
        card.selected
      ) {
        return sessionCards
          .filter(
            (c) =>
              c.selected &&
              (c.zone === "battlefield" || c.zone === "stockpile")
          )
          .map((c) => c.instanceId)
      }
      return [card.instanceId]
    })()

    const putOnBottomItem: DropdownMenuItem = {
      id: "put-bottom",
      label:
        putBottomTargets.length > 1
          ? `Put on bottom (${putBottomTargets.length})`
          : "Put on bottom",
      disabled: Boolean(bottomAnim) || flipAnims.length > 0,
      onSelect: () =>
        setSessionCards((prev) => {
          const next = putCardsOnLibraryBottom(prev, putBottomTargets)
          sessionCardsRef.current = next
          return next
        }),
    }

    if (card.zone === "hand") {
      const pips = extractGainablePips(card.cost)
      const hasCatalog = pips.some((pip) => {
        if (pip.kind === "solid") return resourceByColor.has(pip.color)
        if (pip.kind === "hybrid") {
          return pip.colors.some((c) => resourceByColor.has(c))
        }
        return availableResourceColors.size > 0
      })
      const busy = flipAnims.length > 0 || Boolean(bottomAnim)
      let label = "Accumulate Resources"
      if (busy) label = "Accumulate Resources (busy)"
      else if (pips.length === 0) label = "Accumulate Resources (no colour pips)"
      else if (!hasCatalog) {
        label = "Accumulate Resources (no token cards loaded)"
      }
      return [
        {
          id: "accumulate",
          label,
          disabled: busy || pips.length === 0 || !hasCatalog,
          onSelect: () => startAccumulate(card.instanceId),
        },
        putOnBottomItem,
      ]
    }

    if (card.zone === "battlefield" || card.zone === "stockpile") {
      return [
        {
          id: "add-time",
          label: (
            <>
              Add{" "}
              <span
                aria-hidden
                className="inline-flex min-h-6 min-w-6 items-center justify-center border border-emerald-400/70 bg-emerald-950/90 px-1 font-glitch text-sm leading-none text-emerald-200"
              >
                1
              </span>{" "}
              time counter
            </>
          ),
          onSelect: () =>
            setSessionCards((prev) =>
              adjustCardCounter(prev, card.instanceId, "time", 1)
            ),
        },
        {
          id: "add-damage",
          label: (
            <>
              Add{" "}
              <span
                aria-hidden
                className="inline-flex min-h-6 min-w-6 items-center justify-center border border-red-400/70 bg-red-950/90 px-1 font-glitch text-sm leading-none text-red-200"
              >
                1
              </span>{" "}
              damage counter
            </>
          ),
          onSelect: () =>
            setSessionCards((prev) =>
              adjustCardCounter(prev, card.instanceId, "damage", 1)
            ),
        },
        {
          id: "add-tlv",
          label: (
            <>
              Add <GameIcon name="threat_lvl" className="h-4 w-auto" /> counter
            </>
          ),
          onSelect: () =>
            setSessionCards((prev) =>
              adjustCardCounter(prev, card.instanceId, "tlv", 1)
            ),
        },
        {
          id: "create-copy",
          label: "Create copy",
          onSelect: () =>
            setSessionCards((prev) =>
              duplicatePlayingCard(prev, card.instanceId)
            ),
        },
        {
          id: "generate-resource",
          label: "Generate resource",
          disabled: availableResourceColors.size === 0,
          submenu: RESOURCE_COLORS.map((color) => ({
            id: `gen-resource-${color}`,
            label: (
              <>
                <GameIcon
                  name={RESOURCE_COLOR_ICON[color]}
                  className="h-4 w-auto"
                />
                {color}
              </>
            ),
            disabled: !resourceByColor.has(color),
            onSelect: () => spawnResourceColor(color),
          })),
        },
        // {
        //   id: "remove-time",
        //   label: "Remove time counter",
        //   disabled: time <= 0,
        //   onSelect: () =>
        //     setSessionCards((prev) =>
        //       adjustCardCounter(prev, card.instanceId, "time", -1)
        //     ),
        // },
        // {
        //   id: "remove-damage",
        //   label: "Remove damage counter",
        //   disabled: damage <= 0,
        //   onSelect: () =>
        //     setSessionCards((prev) =>
        //       adjustCardCounter(prev, card.instanceId, "damage", -1)
        //     ),
        // },
        // {
        //   id: "remove-tlv",
        //   label: (
        //     <>
        //       Remove <GameIcon name="threat_lvl" className="h-4 w-auto" />{" "}
        //       counter
        //     </>
        //   ),
        //   disabled: tlv <= 0,
        //   onSelect: () =>
        //     setSessionCards((prev) =>
        //       adjustCardCounter(prev, card.instanceId, "tlv", -1)
        //     ),
        // },
        putOnBottomItem,
      ]
    }

    // Trashyard / dismantled / pilot — bottom only for now.
    return [putOnBottomItem]
  })()

  function onBottomSlideComplete() {
    const current = bottomAnimRef.current
    setBottomAnim(null)
    if (!current) return
    setSessionCards((prev) => putCardOnLibraryBottom(prev, current.card))
  }

  return (
    <section
      className="relative flex h-svh flex-col overflow-hidden bg-cover bg-center bg-no-repeat select-none"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 bg-black/65" aria-hidden />

      <div className="absolute left-3 top-16 z-50">
        <GlitchFx
          type="button"
          label="← BACK TO DECK"
          className="font-buahs93 h-7 rounded-none bg-cyan-700 px-3 text-xs hover:bg-cyan-900"
          onClick={() => {
            // Prefer history back so we do not push a second /decks/:id entry.
            // (Pushing made DeckPage's navigate(-1) return to the playtester.)
            if (window.history.length > 1) {
              navigate(-1)
              return
            }
            if (Number.isFinite(deckId) && deckId > 0) {
              navigate(ROUTES.deck(deckId))
              return
            }
            navigate(ROUTES.MAIN)
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-3 pt-16">
        {status === "error" ? (
          <p className="font-mono text-sm text-red-400" role="alert">
            {errorText}
          </p>
        ) : null}

        {playNotice ? (
          <p
            className="mb-2 font-mono text-xs text-amber-200/90"
            role="status"
          >
            {playNotice}
          </p>
        ) : null}

        {status === "ready" ? (
          <div className="relative z-0 flex min-h-0 flex-1 flex-col gap-2">
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
                onCardCounterAdjust={onFloatCardCounterAdjust}
              />
            </div>

            <div className="relative z-0 flex h-60 min-h-48 w-full shrink-0 items-end gap-2">
              <div
                ref={stockpileRef}
                className="relative z-0 min-h-0 min-w-0 flex-1 self-stretch"
              >
                <p className="pointer-events-none absolute left-2 top-1 z-10 font-mono text-[10px] tracking-wide text-cyan-100/70">
                  Stockpile · {stockpileCards.length}
                </p>
                <FreeFloatSurface
                  className="h-full min-h-0 w-full border-cyan-500/20 pt-4"
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
                  onCardCounterAdjust={onFloatCardCounterAdjust}
                />
              </div>

              <div className="flex shrink-0 flex-col items-center gap-1 self-end">
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
                  onReleaseCard={onFaceUpPileRelease}
                  onCardContextMenu={onFloatCardContextMenu}
                />
              </div>
            </div>

            <div className="relative z-40 flex shrink-0 items-end gap-3 overflow-visible pb-5">
              <div ref={handRef} className="min-w-0 flex-1 self-end">
                <PlayerHand
                  cards={handCards}
                  onReleaseCard={onHandRelease}
                  onCardContextMenu={onHandContextMenu}
                />
              </div>
              <DeckPile
                ref={deckRef}
                count={libraryCount}
                onClickDraw={onDrawFromDeck}
                onTopCardRelease={onDeckTopRelease}
                busy={Boolean(bottomAnim) || mulliganOpen}
              />
              <TrashyardPile
                ref={trashRef}
                cards={trashCards}
                label="Trashyard"
                onReleaseCard={onFaceUpPileRelease}
                onCardContextMenu={onFloatCardContextMenu}
              />
              <TrashyardPile
                ref={dismantledRef}
                cards={dismantledCards}
                label="Dismantled"
                onReleaseCard={onFaceUpPileRelease}
                onCardContextMenu={onFloatCardContextMenu}
              />
            </div>

            <div className="relative z-40 flex shrink-0 items-center gap-2 border-t border-cyan-500/25 bg-black/55 px-3 py-2">
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
    </section>
  )
}
