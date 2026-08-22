/**
 * What one seat is allowed to see. Opponent hand/library are counts only —
 * never instance ids, names, or order.
 */

import {
  PLAY_ZONE,
  type PlayerSlot,
  type PlayZone,
} from "@/components/Playtester/constants"
import type { PlayingCardInstance } from "@/components/Playtester/playCard.logic"
import type { PlaySessionState, SeatRecord } from "@/components/Playtester/sessionActions.logic"

const PRIVATE_ZONES: ReadonlySet<PlayZone> = new Set([
  PLAY_ZONE.hand,
  PLAY_ZONE.library,
])

export type FogStub = {
  hidden: true
  owner: PlayerSlot
  zone: PlayZone
  faceDown: true
  instanceId: string
  x?: number
  y?: number
  expended: boolean
  /** Kept so a face-down augment still renders in its owner's augment row. */
  isAugment?: boolean
}

export type FogCard = PlayingCardInstance | FogStub

export type FogView = {
  viewer: PlayerSlot
  cards: FogCard[]
  handCount: SeatRecord<number>
  libraryCount: SeatRecord<number>
  life: SeatRecord<number>
  turn: number
  turnSeat: PlayerSlot
  pilotGenBonus: SeatRecord<number>
  seq: number
}

export function isFogStub(card: FogCard): card is FogStub {
  return "hidden" in card && card.hidden === true
}

function countZone(
  cards: PlayingCardInstance[],
  zone: PlayZone,
  owner: PlayerSlot
): number {
  return cards.reduce(
    (n, c) => (c.zone === zone && c.owner === owner ? n + 1 : n),
    0
  )
}

/** Face-down public cards: keep position/id, hide printing. */
function asFaceDownStub(card: PlayingCardInstance): FogStub {
  return {
    hidden: true,
    owner: card.owner,
    zone: card.zone,
    faceDown: true,
    instanceId: card.instanceId,
    x: card.x,
    y: card.y,
    expended: card.expended,
    isAugment: card.isAugment,
  }
}

/**
 * Filter full host state for `seat`.
 * Private opponent zones are omitted (counts live on the view object).
 */
export function viewFor(seat: PlayerSlot, state: PlaySessionState): FogView {
  const cards: FogCard[] = []
  for (const card of state.cards) {
    if (card.owner === seat) {
      cards.push(card)
      continue
    }
    if (PRIVATE_ZONES.has(card.zone)) continue
    if (card.faceDown) {
      cards.push(asFaceDownStub(card))
      continue
    }
    cards.push(card)
  }

  return {
    viewer: seat,
    cards,
    handCount: {
      p1: countZone(state.cards, PLAY_ZONE.hand, "p1"),
      p2: countZone(state.cards, PLAY_ZONE.hand, "p2"),
    },
    libraryCount: {
      p1: countZone(state.cards, PLAY_ZONE.library, "p1"),
      p2: countZone(state.cards, PLAY_ZONE.library, "p2"),
    },
    life: state.life,
    turn: state.turn,
    turnSeat: state.turnSeat,
    pilotGenBonus: state.pilotGenBonus,
    seq: state.seq,
  }
}

/** Face-down dummy the guest can render (no printing). */
export function stubToInstance(stub: FogStub): PlayingCardInstance {
  return {
    instanceId: stub.instanceId,
    owner: stub.owner,
    cardId: 0,
    name: "",
    artPath: null,
    cost: [],
    zone: stub.zone,
    x: stub.x,
    y: stub.y,
    expended: stub.expended,
    faceDown: true,
    isAugment: stub.isAugment,
  }
}

function padHiddenHand(
  cards: PlayingCardInstance[],
  owner: PlayerSlot,
  count: number
): PlayingCardInstance[] {
  const have = cards.filter(
    (c) => c.zone === PLAY_ZONE.hand && c.owner === owner
  ).length
  const need = Math.max(0, count - have)
  if (need === 0) return cards
  const extras: PlayingCardInstance[] = []
  for (let i = 0; i < need; i++) {
    extras.push(
      stubToInstance({
        hidden: true,
        owner,
        zone: PLAY_ZONE.hand,
        faceDown: true,
        instanceId: `fog-hand-${owner}-${i}`,
        expended: false,
      })
    )
  }
  return [...cards, ...extras]
}

/**
 * Guest table: real cards the viewer is allowed to see, plus face-down
 * opponent-hand backs so the mirrored row has the right count.
 */
export function materializeFog(view: FogView): PlayingCardInstance[] {
  const mapped = view.cards.map((card) =>
    isFogStub(card) ? stubToInstance(card) : card
  )
  const opp: PlayerSlot = view.viewer === "p1" ? "p2" : "p1"
  return padHiddenHand(mapped, opp, view.handCount[opp])
}
