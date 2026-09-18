/**
 * What one seat is allowed to see. Opponent hand/library are counts only —
 * never instance ids, names, or order.
 */

import {
  PLAY_ZONE,
  type PlayerSlot,
  type PlayZone,
} from "@/components/Playtester/constants"
import type { PlayingCardInstance } from "@/components/Playtester/session/playCard.logic"
import type { PlaySessionState, SeatRecord } from "@/components/Playtester/session/sessionActions.logic"

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
  /** Kept so a face-down objective still renders in its owner's objective row. */
  isObjective?: boolean
  /** @deprecated Use {@link isObjective}. */
  isAugment?: boolean
  selected?: boolean
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
  /** True while a seat's deck top is publicly revealed (both sides see it). */
  topRevealedBySeat: SeatRecord<boolean>
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
    isObjective: card.isObjective ?? card.isAugment,
    isAugment: card.isAugment ?? card.isObjective,
    selected: card.selected,
  }
}

/** First (topmost) library instance per owner, in deck order. */
function topLibraryIdsByOwner(
  cards: PlayingCardInstance[]
): Partial<Record<PlayerSlot, string>> {
  const ids: Partial<Record<PlayerSlot, string>> = {}
  for (const card of cards) {
    if (card.zone !== PLAY_ZONE.library) continue
    if (ids[card.owner]) continue
    ids[card.owner] = card.instanceId
  }
  return ids
}

/**
 * Filter full host state for `seat`.
 * Private opponent zones are omitted (counts live on the view object) —
 * except a seat's revealed deck top, which is a public action and must
 * carry its real identity across so both sides see the same card.
 * Opponent `selected` is stripped — selection is local-only per client.
 */
export function viewFor(seat: PlayerSlot, state: PlaySessionState): FogView {
  const topLibraryIds = topLibraryIdsByOwner(state.cards)
  const cards: FogCard[] = []
  for (const card of state.cards) {
    if (card.owner === seat) {
      cards.push(card)
      continue
    }
    const isRevealedTop =
      card.zone === PLAY_ZONE.library &&
      state.topRevealedBySeat[card.owner] &&
      topLibraryIds[card.owner] === card.instanceId
    if (PRIVATE_ZONES.has(card.zone) && !isRevealedTop) continue
    if (card.faceDown) {
      const stub = asFaceDownStub(card)
      cards.push(stub.selected ? { ...stub, selected: false } : stub)
      continue
    }
    cards.push(card.selected ? { ...card, selected: false } : card)
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
    topRevealedBySeat: state.topRevealedBySeat,
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
    isObjective: stub.isObjective ?? stub.isAugment,
    isAugment: stub.isAugment ?? stub.isObjective,
    selected: stub.selected,
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

/**
 * After fog, keep *this seat's* optimistic selection so a host fog tick
 * cannot clear local cyan rings mid-click.
 */
export function withPreservedSelection(
  cards: PlayingCardInstance[],
  selectedIds: ReadonlySet<string>,
  localSeat: PlayerSlot
): PlayingCardInstance[] {
  return cards.map((card) => {
    if (card.owner !== localSeat) return card
    const next = selectedIds.has(card.instanceId)
    return card.selected === next ? card : { ...card, selected: next }
  })
}

/** Force peer-owned cards to match selection-chrome ids (incl. empty = clear). */
export function withPeerSelectionChrome(
  cards: PlayingCardInstance[],
  peerSeat: PlayerSlot,
  selectedIds: ReadonlySet<string>
): PlayingCardInstance[] {
  return cards.map((card) => {
    if (card.owner !== peerSeat) return card
    const next = selectedIds.has(card.instanceId)
    return card.selected === next ? card : { ...card, selected: next }
  })
}
