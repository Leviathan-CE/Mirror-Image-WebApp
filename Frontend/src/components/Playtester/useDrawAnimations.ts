/**
 * Playtester draw / flip-fly / bottom-slide animations.
 * Owns flight state + timers; page still owns session cards and zone DOM refs.
 */

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react"

import {
  FLIP_FLY_MODE,
  PLAY_ZONE,
  type FlipFlyMode,
  type PlayZone,
} from "@/components/Playtester/playtesterConstants"
import {
  putCardInDismantled,
  putCardInHand,
  putCardInTrashyard,
  putCardOnBattlefield,
  putCardOnLibraryBottom,
  putCardOnLibraryTop,
  putCardOnPilot,
  putCardOnStockpile,
  takeTopLibraryCard,
  type PlayingCardInstance,
} from "@/components/Playtester/types"

export type FlipFlyAnim = {
  id: string
  card: PlayingCardInstance
  mode: FlipFlyMode
  from: { x: number; y: number; w: number; h: number }
  to: { x: number; y: number }
  landZone: PlayZone
  landX?: number
  landY?: number
}

export type BottomSlideAnim = {
  card: PlayingCardInstance
  from: { x: number; y: number; w: number; h: number }
  to: { x: number; y: number }
}

export type PlaytesterZoneRefs = {
  deck: RefObject<HTMLDivElement | null>
  hand: RefObject<HTMLDivElement | null>
  surface: RefObject<HTMLDivElement | null>
  stockpile: RefObject<HTMLDivElement | null>
  pilot: RefObject<HTMLDivElement | null>
  trash: RefObject<HTMLDivElement | null>
  dismantled: RefObject<HTMLDivElement | null>
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

export type UseDrawAnimationsArgs = {
  sessionCardsRef: MutableRefObject<PlayingCardInstance[]>
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
  mulliganOpen: boolean
}

export function useDrawAnimations({
  sessionCardsRef,
  setSessionCards,
  zoneRefs,
  clientToSurfaceLocal,
  clientToStockpileLocal,
  mulliganOpen,
}: UseDrawAnimationsArgs) {
  const [flipAnims, setFlipAnims] = useState<FlipFlyAnim[]>([])
  const flipAnimsRef = useRef<FlipFlyAnim[]>([])
  flipAnimsRef.current = flipAnims
  const flipAnimIdRef = useRef(0)

  const [bottomAnim, setBottomAnim] = useState<BottomSlideAnim | null>(null)
  const bottomAnimRef = useRef<BottomSlideAnim | null>(null)
  bottomAnimRef.current = bottomAnim

  const mulliganTimersRef = useRef<number[]>([])
  const drawBurstOffsetRef = useRef(0)
  const clickDrawRouteRef = useRef<{
    from: { x: number; y: number; w: number; h: number }
    to: { x: number; y: number }
  } | null>(null)

  function clearDrawTimers() {
    for (const t of mulliganTimersRef.current) window.clearTimeout(t)
    mulliganTimersRef.current = []
  }

  useEffect(() => () => clearDrawTimers(), [])

  function isFlipFlying(): boolean {
    return flipAnimsRef.current.length > 0
  }

  function hasPendingDrawTimers(): boolean {
    return mulliganTimersRef.current.length > 0
  }

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
    concurrent?: boolean
    landOffsetIndex?: number
    frozenRoute?: {
      from: { x: number; y: number; w: number; h: number }
      to: { x: number; y: number }
    }
  }): boolean {
    if (!options?.concurrent && flipAnimsRef.current.length > 0) return false

    const deckEl = zoneRefs.deck.current
    const handEl = zoneRefs.hand.current
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
      mode: FLIP_FLY_MODE.draw,
      from,
      to,
      landZone: PLAY_ZONE.hand,
    })
    return true
  }

  function onDrawFromDeck() {
    if (mulliganOpen || mulliganTimersRef.current.length > 0) return

    const deckEl = zoneRefs.deck.current
    const handEl = zoneRefs.hand.current
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

  function queueDrawsToHand(count: number) {
    clearDrawTimers()
    if (count <= 0) return

    const deckEl = zoneRefs.deck.current
    const handEl = zoneRefs.hand.current
    if (!deckEl || !handEl) return

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

  function onDeckTopRelease(clientX: number, clientY: number) {
    if (flipAnimsRef.current.length > 0) return

    const deckEl = zoneRefs.deck.current
    if (!deckEl) return
    if (pointInRect(clientX, clientY, deckEl)) return

    const deckRect = deckEl.getBoundingClientRect()
    const w = deckRect.width
    const h = deckRect.height

    let landZone: PlayZone | null = null
    let to = { x: clientX - w / 2, y: clientY - h / 2 }
    let landX: number | undefined
    let landY: number | undefined

    if (pointInRect(clientX, clientY, zoneRefs.hand.current)) {
      landZone = PLAY_ZONE.hand
      const handRect = zoneRefs.hand.current!.getBoundingClientRect()
      to = {
        x: handRect.right - w - 12,
        y: handRect.top + (handRect.height - h) / 2,
      }
    } else if (pointInRect(clientX, clientY, zoneRefs.trash.current)) {
      landZone = PLAY_ZONE.trashyard
      const trashRect = zoneRefs.trash.current!.getBoundingClientRect()
      to = { x: trashRect.left, y: trashRect.top }
    } else if (pointInRect(clientX, clientY, zoneRefs.dismantled.current)) {
      landZone = PLAY_ZONE.dismantled
      const dismantledRect = zoneRefs.dismantled.current!.getBoundingClientRect()
      to = { x: dismantledRect.left, y: dismantledRect.top }
    } else if (pointInRect(clientX, clientY, zoneRefs.stockpile.current)) {
      landZone = PLAY_ZONE.stockpile
      const local = clientToStockpileLocal(clientX, clientY)
      landX = local.x
      landY = local.y
      to = { x: clientX - w / 2, y: clientY - h / 2 }
    } else if (pointInRect(clientX, clientY, zoneRefs.pilot.current)) {
      landZone = PLAY_ZONE.pilot
      const pilotRect = zoneRefs.pilot.current!.getBoundingClientRect()
      to = { x: pilotRect.left, y: pilotRect.top }
    } else if (pointInRect(clientX, clientY, zoneRefs.surface.current)) {
      landZone = PLAY_ZONE.battlefield
      const local = clientToSurfaceLocal(clientX, clientY)
      landX = local.x
      landY = local.y
      to = { x: clientX - w / 2, y: clientY - h / 2 }
    }

    if (!landZone) return

    const taken = takeTopLibraryCard(sessionCardsRef.current)
    if (!taken) return

    const stayFaceDown =
      landZone === PLAY_ZONE.battlefield || landZone === PLAY_ZONE.stockpile
    const flyingCard = { ...taken.drawn, faceDown: stayFaceDown }

    sessionCardsRef.current = taken.cards
    setSessionCards(taken.cards)
    pushFlipAnim({
      card: flyingCard,
      mode: stayFaceDown ? FLIP_FLY_MODE.faceDown : FLIP_FLY_MODE.draw,
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

    if (
      current.landZone === PLAY_ZONE.library ||
      current.mode === FLIP_FLY_MODE.put
    ) {
      const next = putCardOnLibraryTop(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === PLAY_ZONE.hand) {
      const next = putCardInHand(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === PLAY_ZONE.trashyard) {
      const next = putCardInTrashyard(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === PLAY_ZONE.dismantled) {
      const next = putCardInDismantled(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === PLAY_ZONE.stockpile) {
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
    if (current.landZone === PLAY_ZONE.pilot) {
      const next = putCardOnPilot(sessionCardsRef.current, current.card)
      sessionCardsRef.current = next
      setSessionCards(next)
      return
    }
    if (current.landZone === PLAY_ZONE.battlefield) {
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

  function startBottomSlide(
    card: PlayingCardInstance,
    from: { x: number; y: number; w: number; h: number }
  ) {
    const deckEl = zoneRefs.deck.current
    const deckRect = deckEl?.getBoundingClientRect()
    const to = deckRect
      ? { x: deckRect.left, y: deckRect.top }
      : { x: from.x, y: from.y - 80 }
    setBottomAnim({ card, from, to })
  }

  function onBottomSlideComplete() {
    const current = bottomAnimRef.current
    setBottomAnim(null)
    if (!current) return
    setSessionCards((prev) => putCardOnLibraryBottom(prev, current.card))
  }

  const animBusy = flipAnims.length > 0 || Boolean(bottomAnim)

  return {
    flipAnims,
    bottomAnim,
    animBusy,
    isFlipFlying,
    hasPendingDrawTimers,
    pushFlipAnim,
    onDrawFromDeck,
    queueDrawsToHand,
    onDeckTopRelease,
    onFlipAnimComplete,
    startBottomSlide,
    onBottomSlideComplete,
    clearDrawTimers,
  }
}
