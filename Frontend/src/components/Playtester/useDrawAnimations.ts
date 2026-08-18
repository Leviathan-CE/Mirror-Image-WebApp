/**
 * Playtester draw / flip-fly / bottom-slide animations.
 * Owns flight state + timers; page still owns session cards and zone DOM refs.
 */

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react"

import {
  FLIP_FLY_MODE,
  LOCAL_SEAT,
  PLAY_ZONE,
  type FlipFlyMode,
  type PlayZone,
  type PlayerSlot,
} from "@/components/Playtester/playtesterConstants"
import { peekTopLibrary } from "@/components/Playtester/deckActions.logic"
import {
  type PlayingCardInstance,
  type SessionAction,
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
  /** Zone change already applied via dispatch — complete only unhides. */
  alreadyCommitted?: boolean
}

export type BottomSlideAnim = {
  card: PlayingCardInstance
  from: { x: number; y: number; w: number; h: number }
  to: { x: number; y: number }
}

/** Face-down lift-and-tuck on the deck pile (top card → bottom of deck). */
export type TuckUnderAnim = {
  id: string
  from: { x: number; y: number; w: number; h: number }
}

/** Riffle shuffle played over the deck pile. */
export type ShuffleAnim = {
  from: { x: number; y: number; w: number; h: number }
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
  dispatch: (action: SessionAction) => unknown
  localSeat?: PlayerSlot
  zoneRefs: PlaytesterZoneRefs
  clientToSurfaceLocal: (clientX: number, clientY: number) => {
    x: number
    y: number
  }
  mulliganOpen: boolean
}

export function useDrawAnimations({
  sessionCardsRef,
  dispatch,
  localSeat = LOCAL_SEAT,
  zoneRefs,
  clientToSurfaceLocal,
  mulliganOpen,
}: UseDrawAnimationsArgs) {
  const [flipAnims, setFlipAnims] = useState<FlipFlyAnim[]>([])
  const flipAnimsRef = useRef<FlipFlyAnim[]>([])
  flipAnimsRef.current = flipAnims
  const flipAnimIdRef = useRef(0)

  const [bottomAnim, setBottomAnim] = useState<BottomSlideAnim | null>(null)
  const bottomAnimRef = useRef<BottomSlideAnim | null>(null)
  bottomAnimRef.current = bottomAnim

  const [tuckAnims, setTuckAnims] = useState<TuckUnderAnim[]>([])
  const tuckAnimsRef = useRef<TuckUnderAnim[]>([])
  tuckAnimsRef.current = tuckAnims
  const tuckAnimIdRef = useRef(0)

  const [shuffleAnim, setShuffleAnim] = useState<ShuffleAnim | null>(null)
  const [flyingIds, setFlyingIds] = useState<string[]>([])
  const flyingIdsRef = useRef<string[]>([])
  flyingIdsRef.current = flyingIds

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

  function hideFlying(ids: string[]) {
    if (ids.length === 0) return
    const next = [...new Set([...flyingIdsRef.current, ...ids])]
    flyingIdsRef.current = next
    setFlyingIds(next)
  }

  function showFlying(ids: string[]) {
    if (ids.length === 0) return
    const drop = new Set(ids)
    const next = flyingIdsRef.current.filter((id) => !drop.has(id))
    flyingIdsRef.current = next
    setFlyingIds(next)
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

    const drawn = peekTopLibrary(sessionCardsRef.current, 1, localSeat)[0]
    if (!drawn) return false

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

    hideFlying([drawn.instanceId])
    dispatch({ t: "dr", seat: localSeat, n: 1 })
    pushFlipAnim({
      card: { ...drawn, zone: PLAY_ZONE.hand },
      mode: FLIP_FLY_MODE.draw,
      from,
      to,
      landZone: PLAY_ZONE.hand,
      alreadyCommitted: true,
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

  /** Mill one top library card into the trashyard with a back→face fly. */
  function beginDegradeToTrash(options?: {
    concurrent?: boolean
    frozenRoute?: {
      from: { x: number; y: number; w: number; h: number }
      to: { x: number; y: number }
    }
  }): boolean {
    if (!options?.concurrent && flipAnimsRef.current.length > 0) return false

    const deckEl = zoneRefs.deck.current
    const trashEl = zoneRefs.trash.current
    if (!deckEl || !trashEl) return false

    const drawn = peekTopLibrary(sessionCardsRef.current, 1, localSeat)[0]
    if (!drawn) return false

    let from: { x: number; y: number; w: number; h: number }
    let to: { x: number; y: number }

    if (options?.frozenRoute) {
      from = options.frozenRoute.from
      to = options.frozenRoute.to
    } else {
      const deckRect = deckEl.getBoundingClientRect()
      const trashRect = trashEl.getBoundingClientRect()
      from = {
        x: deckRect.left,
        y: deckRect.top,
        w: deckRect.width,
        h: deckRect.height,
      }
      to = { x: trashRect.left, y: trashRect.top }
    }

    hideFlying([drawn.instanceId])
    dispatch({ t: "dg", seat: localSeat, n: 1 })
    pushFlipAnim({
      card: { ...drawn, zone: PLAY_ZONE.trashyard },
      mode: FLIP_FLY_MODE.draw,
      from,
      to,
      landZone: PLAY_ZONE.trashyard,
      alreadyCommitted: true,
    })
    return true
  }

  /**
   * Lift-and-tuck the deck's top card, once per card put on the bottom.
   * Purely visual: the library keeps the same size, so state is applied by the caller.
   * Long moves only animate the first few cards so the table is not blocked.
   */
  function queueTuckUnderDeck(count: number) {
    const deckEl = zoneRefs.deck.current
    if (!deckEl || count <= 0) return

    const rect = deckEl.getBoundingClientRect()
    const from = {
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
    }

    const MAX_VISUAL = 6
    const STAGGER_MS = 140
    const shown = Math.min(count, MAX_VISUAL)

    for (let i = 0; i < shown; i++) {
      const timer = window.setTimeout(() => {
        tuckAnimIdRef.current += 1
        const next: TuckUnderAnim = {
          id: `tuck-${tuckAnimIdRef.current}`,
          from,
        }
        const list = [...tuckAnimsRef.current, next]
        tuckAnimsRef.current = list
        setTuckAnims(list)
        mulliganTimersRef.current = mulliganTimersRef.current.filter(
          (id) => id !== timer
        )
      }, i * STAGGER_MS)
      mulliganTimersRef.current.push(timer)
    }
  }

  /** Riffle the pile once (cosmetic — caller reorders the library). */
  function startDeckShuffle() {
    const deckEl = zoneRefs.deck.current
    if (!deckEl) return
    const rect = deckEl.getBoundingClientRect()
    setShuffleAnim({
      from: {
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
      },
    })
  }

  function onShuffleAnimComplete() {
    setShuffleAnim(null)
  }

  function onTuckAnimComplete(animId: string) {
    const remaining = tuckAnimsRef.current.filter((a) => a.id !== animId)
    tuckAnimsRef.current = remaining
    setTuckAnims(remaining)
  }

  /** Degrade X — flip-fly top cards to trash in quick succession. */
  function queueDegradeToTrashyard(count: number) {
    clearDrawTimers()
    if (count <= 0) return

    const deckEl = zoneRefs.deck.current
    const trashEl = zoneRefs.trash.current
    if (!deckEl || !trashEl) return

    const deckRect = deckEl.getBoundingClientRect()
    const trashRect = trashEl.getBoundingClientRect()
    const frozenRoute = {
      from: {
        x: deckRect.left,
        y: deckRect.top,
        w: deckRect.width,
        h: deckRect.height,
      },
      to: { x: trashRect.left, y: trashRect.top },
    }

    const STAGGER_MS = 120
    for (let i = 0; i < count; i++) {
      const timer = window.setTimeout(() => {
        beginDegradeToTrash({ concurrent: true, frozenRoute })
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

    const drawn = peekTopLibrary(sessionCardsRef.current, 1, localSeat)[0]
    if (!drawn) return

    const stayFaceDown = landZone === PLAY_ZONE.battlefield
    const flyingCard = {
      ...drawn,
      faceDown: stayFaceDown,
      zone: landZone,
      x: landX,
      y: landY,
    }

    hideFlying([drawn.instanceId])
    dispatch({
      t: "mv",
      seat: localSeat,
      i: [drawn.instanceId],
      z: landZone,
      x: landX,
      y: landY,
    })
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
      alreadyCommitted: true,
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
    showFlying([current.card.instanceId])
    if (current.alreadyCommitted) return

    dispatch({
      t: "mv",
      seat: current.card.owner ?? localSeat,
      i: [current.card.instanceId],
      z: current.landZone,
      x: current.landX,
      y: current.landY,
    })
  }

  /**
   * Last time counter left a stockpile card: slide it onto the battlefield
   * (no flip — keeps its current face).
   */
  function queueStockpileTimeCompletions(launching: PlayingCardInstance[]) {
    if (launching.length === 0) return

    const stockEl = zoneRefs.stockpile.current
    const surfaceEl = zoneRefs.surface.current
    const deckEl = zoneRefs.deck.current
    const deckRect = deckEl?.getBoundingClientRect()
    const cardW = deckRect?.width ?? 112
    const cardH = deckRect?.height ?? 144

    if (!stockEl || !surfaceEl) return

    hideFlying(launching.map((c) => c.instanceId))
    const stockRect = stockEl.getBoundingClientRect()
    const surfaceRect = surfaceEl.getBoundingClientRect()

    launching.forEach((card, index) => {
      const landX = card.x ?? 24 + index * 28
      const landY = card.y ?? 48
      pushFlipAnim({
        card,
        mode: FLIP_FLY_MODE.faceDown,
        from: {
          x: stockRect.left + (card.x ?? 0),
          y: stockRect.top + (card.y ?? 0),
          w: cardW,
          h: cardH,
        },
        to: {
          x: surfaceRect.left + landX,
          y: surfaceRect.top + landY,
        },
        landZone: PLAY_ZONE.battlefield,
        landX,
        landY,
        alreadyCommitted: true,
      })
    })
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
    hideFlying([card.instanceId])
    setBottomAnim({ card, from, to })
  }

  function onBottomSlideComplete() {
    const current = bottomAnimRef.current
    setBottomAnim(null)
    if (current) showFlying([current.card.instanceId])
  }

  const animBusy =
    flipAnims.length > 0 ||
    Boolean(bottomAnim) ||
    tuckAnims.length > 0 ||
    Boolean(shuffleAnim)

  return {
    flipAnims,
    bottomAnim,
    tuckAnims,
    onTuckAnimComplete,
    queueTuckUnderDeck,
    shuffleAnim,
    startDeckShuffle,
    onShuffleAnimComplete,
    animBusy,
    isFlipFlying,
    hasPendingDrawTimers,
    pushFlipAnim,
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
  }
}
