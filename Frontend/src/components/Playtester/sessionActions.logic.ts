/**
 * Host-authoritative session: one bag of cards + per-seat scalars.
 * UI and the network must both go through `applyAction` so a later rules
 * server can reuse this table without a second playtester.
 */

import {
  LOCAL_SEAT,
  PLAYER_SLOT,
  PLAY_ZONE,
  PILOT_GEN_MAX,
  type PlayerSlot,
  type PlayZone,
} from "@/components/Playtester/constants"
import {
  adjustCardCounter,
  duplicatePlayingCard,
  extractStockpileTimeCompletions,
  moveCardtoBack,
  moveCardtoFront,
  readyBattlefieldAndStockpile,
  setCardsFaceDown,
  toggleExpended,
  type CardCounterKind,
  type PlayingCardInstance,
} from "@/components/Playtester/playCard.logic"
import {
  degradeTopLibrary,
  putTopLibraryOnBottom,
  reorderTopLibrary,
  shuffleLibrary,
} from "@/components/Playtester/deckActions.logic"
import { rngFromState, type RngState } from "@/components/Playtester/rng.logic"
import {
  moveAllFromZone,
  moveToBattlefield,
  moveToDismantled,
  moveToHand,
  moveToPilot,
  moveToStockpile,
  moveToTrashyard,
  putCardInHand,
  putCardOnBattlefield,
  putCardOnLibraryTop,
  putCardsOnLibraryBottom,
  takeTopLibraryCard,
  type MoveAllDestinationZone,
  type MoveAllSourceZone,
} from "@/components/Playtester/zoneMoves.logic"

export type SeatRecord<T> = Record<PlayerSlot, T>

export type PlaySessionState = {
  cards: PlayingCardInstance[]
  life: SeatRecord<number>
  turn: number
  turnSeat: PlayerSlot
  pilotGenBonus: SeatRecord<number>
  /** Mulberry32 state; mutated only inside applyAction. */
  rng: RngState
  /** Monotonic mint for copies / tokens (replaces Date.now ids). */
  nextId: number
  /** Host sequence — every applied action bumps this. */
  seq: number
}

export function seatRecord<T>(p1: T, p2: T = p1): SeatRecord<T> {
  return { [PLAYER_SLOT.p1]: p1, [PLAYER_SLOT.p2]: p2 }
}

export function createPlaySessionState(
  partial: Partial<PlaySessionState> & { cards: PlayingCardInstance[] }
): PlaySessionState {
  return {
    life: seatRecord(0),
    turn: 1,
    turnSeat: LOCAL_SEAT,
    pilotGenBonus: seatRecord(0),
    rng: 1,
    nextId: 1,
    seq: 0,
    ...partial,
  }
}

/**
 * Compact action tags (wire size). `seat` is whose private zone / life the
 * action touches. Host still validates; guest sends intents only.
 */
export type SessionAction =
  | {
      t: "mv"
      seat: PlayerSlot
      i: string[]
      z: PlayZone
      x?: number
      y?: number
    }
  | { t: "dr"; seat: PlayerSlot; n?: number }
  | { t: "sh"; seat: PlayerSlot }
  | { t: "dg"; seat: PlayerSlot; n: number }
  | { t: "rdy"; seat: PlayerSlot }
  | { t: "lf"; seat: PlayerSlot; d: number }
  | { t: "xp"; i: string[] }
  /** Replace this seat's selection (other seats untouched). */
  | { t: "sel"; seat: PlayerSlot; i: string[] }
  | { t: "cp"; i: string[] }
  | { t: "rm"; i: string[] }
  | {
      t: "ma"
      seat: PlayerSlot
      from: MoveAllSourceZone
      to: MoveAllDestinationZone
    }
  | { t: "lb"; i: string[] }
  | { t: "tb"; seat: PlayerSlot; n: number }
  | { t: "ro"; seat: PlayerSlot; i: string[] }
  | { t: "fd"; i: string[]; down: boolean }
  | { t: "ct"; i: string[]; k: CardCounterKind; d: number }
  | { t: "fr"; i: string }
  | { t: "bk"; i: string }
  | { t: "ps"; i: Array<{ id: string; x: number; y: number }> }
  | { t: "pg"; seat: PlayerSlot; d: number }
  | { t: "ts"; seat: PlayerSlot }
  | {
      t: "tk"
      seat: PlayerSlot
      cardId: number
      name: string
      artPath: string | null
      artVersion?: number | null
      cost: string[]
      x?: number
      y?: number
    }

function bump(state: PlaySessionState, cards: PlayingCardInstance[]): PlaySessionState {
  return { ...state, cards, seq: state.seq + 1 }
}

function moveOne(
  cards: PlayingCardInstance[],
  instanceId: string,
  zone: PlayZone,
  x: number,
  y: number
): PlayingCardInstance[] {
  switch (zone) {
    case PLAY_ZONE.hand:
      return moveToHand(cards, instanceId)
    case PLAY_ZONE.battlefield:
      return moveToBattlefield(cards, instanceId, x, y)
    case PLAY_ZONE.stockpile:
      return moveToStockpile(cards, instanceId, x, y)
    case PLAY_ZONE.pilot:
      return moveToPilot(cards, instanceId)
    case PLAY_ZONE.trashyard:
      return moveToTrashyard(cards, instanceId)
    case PLAY_ZONE.dismantled:
      return moveToDismantled(cards, instanceId)
    case PLAY_ZONE.library: {
      const card = cards.find((c) => c.instanceId === instanceId)
      if (!card) return cards
      return putCardOnLibraryTop(cards, card)
    }
    default:
      return cards
  }
}

function applyTimeCompletions(
  before: PlayingCardInstance[],
  after: PlayingCardInstance[]
): PlayingCardInstance[] {
  const { cards, launching } = extractStockpileTimeCompletions(before, after)
  let next = cards
  for (const card of launching) {
    next = putCardOnBattlefield(next, card, card.x ?? 40, card.y ?? 40)
  }
  return next
}

/**
 * Pure (state, action) → state. Side effects (animations, sockets) stay
 * outside. Replaying `actions` from the same seed rebuilds the board.
 */
export function applyAction(
  state: PlaySessionState,
  action: SessionAction
): PlaySessionState {
  switch (action.t) {
    case "mv": {
      let cards = state.cards
      const x = action.x ?? 0
      const y = action.y ?? 0
      for (const id of action.i) {
        const card = cards.find((c) => c.instanceId === id)
        if (!card || card.owner !== action.seat) continue
        cards = moveOne(cards, id, action.z, x, y)
      }
      return bump(state, cards)
    }
    case "dr": {
      const count = Math.max(1, Math.floor(action.n ?? 1))
      let cards = state.cards
      for (let i = 0; i < count; i++) {
        const taken = takeTopLibraryCard(cards, action.seat)
        if (!taken) break
        cards = putCardInHand(taken.cards, taken.drawn)
      }
      return bump(state, cards)
    }
    case "sh": {
      const cell = { current: state.rng }
      const cards = shuffleLibrary(state.cards, action.seat, rngFromState(cell))
      return { ...bump(state, cards), rng: cell.current }
    }
    case "dg":
      return bump(state, degradeTopLibrary(state.cards, action.n, action.seat))
    case "rdy": {
      const after = readyBattlefieldAndStockpile(state.cards, action.seat)
      return bump(state, applyTimeCompletions(state.cards, after))
    }
    case "lf": {
      const next = Math.max(0, (state.life[action.seat] ?? 0) + action.d)
      return {
        ...state,
        life: { ...state.life, [action.seat]: next },
        seq: state.seq + 1,
      }
    }
    case "xp": {
      let cards = state.cards
      for (const id of action.i) cards = toggleExpended(cards, id)
      return bump(state, cards)
    }
    case "sel": {
      const ids = new Set(action.i)
      return bump(
        state,
        state.cards.map((card) => {
          if (card.owner !== action.seat) return card
          const next = ids.has(card.instanceId)
          return card.selected === next ? card : { ...card, selected: next }
        })
      )
    }
    case "cp": {
      let cards = state.cards
      let nextId = state.nextId
      for (const id of action.i) {
        const beforeLen = cards.length
        cards = duplicatePlayingCard(cards, id)
        if (cards.length === beforeLen) continue
        const copy = cards[cards.length - 1]!
        cards = [
          ...cards.slice(0, -1),
          { ...copy, instanceId: `copy-${nextId}` },
        ]
        nextId += 1
      }
      return { ...bump(state, cards), nextId }
    }
    case "rm": {
      const ids = new Set(action.i)
      return bump(
        state,
        state.cards.filter((c) => !ids.has(c.instanceId))
      )
    }
    case "ma":
      return bump(
        state,
        moveAllFromZone(state.cards, action.from, action.to, action.seat)
      )
    case "lb":
      return bump(state, putCardsOnLibraryBottom(state.cards, action.i))
    case "tb":
      return bump(state, putTopLibraryOnBottom(state.cards, action.n, action.seat))
    case "ro":
      return bump(state, reorderTopLibrary(state.cards, action.i, action.seat))
    case "fd":
      return bump(state, setCardsFaceDown(state.cards, action.i, action.down))
    case "ct": {
      let after = state.cards
      for (const id of action.i) {
        after = adjustCardCounter(after, id, action.k, action.d)
      }
      const cards =
        action.k === "time"
          ? applyTimeCompletions(state.cards, after)
          : after
      return bump(state, cards)
    }
    case "fr":
      return bump(state, moveCardtoFront(state.cards, action.i))
    case "bk":
      return bump(state, moveCardtoBack(state.cards, action.i))
    case "ps": {
      const byId = new Map(action.i.map((m) => [m.id, m]))
      return bump(
        state,
        state.cards.map((card) => {
          const move = byId.get(card.instanceId)
          return move ? { ...card, x: move.x, y: move.y } : card
        })
      )
    }
    case "pg": {
      const next = Math.max(
        0,
        Math.min(PILOT_GEN_MAX, (state.pilotGenBonus[action.seat] ?? 0) + action.d)
      )
      return {
        ...state,
        pilotGenBonus: { ...state.pilotGenBonus, [action.seat]: next },
        seq: state.seq + 1,
      }
    }
    case "ts":
      return {
        ...state,
        turn: state.turn + 1,
        turnSeat: action.seat,
        seq: state.seq + 1,
      }
    case "tk": {
      const token: PlayingCardInstance = {
        instanceId: `tok-${state.nextId}`,
        cardId: action.cardId,
        owner: action.seat,
        name: action.name,
        artPath: action.artPath,
        artVersion: action.artVersion ?? null,
        cost: action.cost,
        zone: PLAY_ZONE.stockpile,
        x: action.x,
        y: action.y,
        expended: false,
        selected: false,
        isToken: true,
      }
      return {
        ...bump(state, [...state.cards, token]),
        nextId: state.nextId + 1,
      }
    }
  }
}

export function applyActions(
  state: PlaySessionState,
  actions: readonly SessionAction[]
): PlaySessionState {
  return actions.reduce(applyAction, state)
}
