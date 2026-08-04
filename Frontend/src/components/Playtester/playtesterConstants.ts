/**
 * Shared playtester identity values (zones, anim modes, storage, menu ids).
 * Prefer these over raw string literals when the value is a contract across files.
 * UI copy (button labels) stays inline at the call site.
 */

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
} as const

/** Stockpile row height (px) — drag the seam under the battlefield to resize. */
export const STOCKPILE_HEIGHT = {
  min: 120,
  max: 480,
  default: 240,
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

export const PILOT_GEN_MAX = 10

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
  addOtherCounter: "add-other-counter",
  addGeneric: "add-generic",
  addDepletion: "add-depletion",
  createCopy: "create-copy",
  addPilotGen: "add-pilot-gen",
  removePilotGen: "remove-pilot-gen",
  deckDegrade: "deck-degrade",
  deckLookTop: "deck-look-top",
  deckPutTopBottom: "deck-put-top-bottom",
  deckShuffle: "deck-shuffle",
  deckRevealTop: "deck-reveal-top",
  deckSearch: "deck-search",
  moveAll: "move-all",
  moveAllToDeck: "move-all-to-deck",
  moveAllToStockpile: "move-all-to-stockpile",
  moveAllToTrashyard: "move-all-to-trashyard",
} as const

export type CtxMenuActionId =
  (typeof CTX_MENU_ACTION)[keyof typeof CTX_MENU_ACTION]
