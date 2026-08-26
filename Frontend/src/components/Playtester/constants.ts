/**
 * Shared playtester identity values (zones, anim modes, storage, menu ids).
 * Prefer these over raw string literals when the value is a contract across files.
 * UI copy (button labels) stays inline at the call site.
 */

import type { GameIconName } from "@/components/common/GameIcon"
import type { ResourceColor } from "@/components/Playtester/accumulateResources.logic"

/** Two seats at a shared table. Solo play is always p1. */
export const PLAYER_SLOT = {
  p1: "p1",
  p2: "p2",
} as const

export type PlayerSlot = (typeof PLAYER_SLOT)[keyof typeof PLAYER_SLOT]

/** Seat the local/solo client occupies until multiplayer assigns otherwise. */
export const LOCAL_SEAT: PlayerSlot = PLAYER_SLOT.p1

export function otherSeat(seat: PlayerSlot): PlayerSlot {
  return seat === PLAYER_SLOT.p1 ? PLAYER_SLOT.p2 : PLAYER_SLOT.p1
}

/** All session zones a card can occupy. */
export const PLAY_ZONE = {
  hand: "hand",
  battlefield: "battlefield",
  library: "library",
  stockpile: "stockpile",
  pilot: "pilot",
  trashyard: "trashyard",
  dismantled: "dismantled",
} as const

export type PlayZone = (typeof PLAY_ZONE)[keyof typeof PLAY_ZONE]

/**
 * Zones that participate in multi-select context actions
 * (flip / delete / put on bottom).
 */
export const SELECTABLE_ACTION_ZONES = [
  PLAY_ZONE.hand,
  PLAY_ZONE.battlefield,
  PLAY_ZONE.stockpile,
] as const

export type SelectableActionZone = (typeof SELECTABLE_ACTION_ZONES)[number]

export const FLIP_FLY_MODE = {
  draw: "draw",
  put: "put",
  faceDown: "faceDown",
} as const

export type FlipFlyMode = (typeof FLIP_FLY_MODE)[keyof typeof FLIP_FLY_MODE]

/** localStorage keys owned by the playtester. */
export const PLAYTESTER_STORAGE = {
  stockpileHeightPx: "mi-playtester-stockpile-height-px",
  deckSearchBoxPx: "mi-playtester-deck-search-box-px",
  faceUpPileBrowserBoxPx: "mi-playtester-face-up-pile-browser-box-px",
  handBoxPx: "mi-playtester-hand-box-px",
  oppHandBoxPx: "mi-playtester-opp-hand-box-px",
} as const

/** Stockpile row height (px) — drag the seam under the battlefield to resize. */
export const STOCKPILE_HEIGHT = {
  min: 120,
  max: 480,
  default: 240,
  /** Opponent's stockpile: read-only, so it only needs to show the pile tops. */
  opponent: 156,
} as const

/**
 * Deck search panel box (px) — drag the header to move it, the bottom-right
 * grip to resize.
 */
export const DECK_SEARCH_SIZE = {
  minWidth: 240,
  maxWidth: 1200,
  defaultWidth: 352,
  minHeight: 200,
  maxHeight: 900,
  defaultHeight: 448,
} as const

/**
 * Hand window sizing (px). Used as the default footprint for opening homes
 * on the field, and `defaultHeight` is the docked hand strip height.
 */
export const HAND_FLOAT_SIZE = {
  minWidth: 280,
  maxWidth: 1400,
  defaultWidth: 640,
  minHeight: 148,
  maxHeight: 420,
  defaultHeight: 176,
} as const

/** Layout height of the docked hand strip (card row; label floats on top). */
export const HAND_DOCK_HEIGHT_PX = HAND_FLOAT_SIZE.defaultHeight

/**
 * Hand card footprint (px). Height tracks the window; width follows 3:4.
 * `chromeY` is PlayerHand padding (pt-2+pb-1) plus the horizontal scrollbar.
 */
export const HAND_CARD_SIZE = {
  defaultWidth: 96,
  defaultHeight: 128,
  minHeight: 64,
  maxHeight: 320,
  chromeY: 24,
} as const

export const PILOT_GEN_MAX = 10

/**
 * Side-column pile footprints (3:4). `lg` is the playtester column
 * (pilot, library, trashyard, dismantled).
 */
export const PLAY_PILE_SIZE = {
  md: { w: 96, h: 128, peek: 34 },
  lg: { w: 132, h: 176, peek: 46 },
} as const

export type PlayPileSize = keyof typeof PLAY_PILE_SIZE

/** Pilot / hero pile footprint (matches TrashyardPile `lg`). */
export const PILOT_PILE = {
  w: PLAY_PILE_SIZE.lg.w,
  h: PLAY_PILE_SIZE.lg.h,
} as const

/** Opening mulligan modal — off until exposed as a playtester setting. */
export const OPENING_MULLIGAN_ENABLED = false

/** Stable DropdownMenu / ContextMenu item ids (not user-facing labels). */
export const CTX_MENU_ACTION = {
  generateResource: "generate-resource",
  putBottom: "put-bottom",
  cardDetails: "CardDetails",
  flipFace: "flip-face",
  deleteCard: "delete-card",
  accumulate: "accumulate",
  addTime: "add-time",
  addDamage: "add-damage",
  addTlv: "add-tlv",
  addTlvMinus: "add-tlv-minus",
  addOtherCounter: "add-other-counter",
  addGeneric: "add-generic",
  addDepletion: "add-depletion",
  createCopy: "create-copy",
  addPilotGen: "add-pilot-gen",
  removePilotGen: "remove-pilot-gen",
  toggleExpended: "toggle-expended",
  deckDegrade: "deck-degrade",
  deckLookTop: "deck-look-top",
  deckPutTopBottom: "deck-put-top-bottom",
  deckShuffle: "deck-shuffle",
  deckRevealTop: "deck-reveal-top",
  deckSearch: "deck-search",
  pileSearch: "pile-search",
  moveAll: "move-all",
  moveAllToDeck: "move-all-to-deck",
  moveAllToDismantled: "move-all-to-dismantled",
  moveAllToTrashyard: "move-all-to-trashyard",
  sendToStockpile: "send-to-stockpile",
  sendToBattlefield: "send-to-battlefield",
} as const

export type CtxMenuActionId =
  (typeof CTX_MENU_ACTION)[keyof typeof CTX_MENU_ACTION]

/** Cost colour → GameIcon asset name (context menu / accumulate UI). */
export const RESOURCE_COLOR_ICON: Record<ResourceColor, GameIconName> = {
  LIF: "life",
  MET: "metal",
  POW: "power",
  RAM: "ram",
  TIM: "time",
  STL: "steel",
}

/** Map a pilot +GEN bonus (1-10) to a cost icon. */
export function genIconForCount(n: number): GameIconName {
  if (n <= 0) return "gen0"
  if (n >= 10) return "gen10"
  return `gen${n}` as GameIconName
}