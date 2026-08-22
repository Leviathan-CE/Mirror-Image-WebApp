/**
 * Standard play UI screen + float field inside it.
 *
 * `PLAY_FIELD_LOGICAL` is the shared *screen* canvas (hands, piles, float).
 * Every client lays the same chrome out in that space, then one CSS fit-scale
 * paints it into the real viewport — so piles/hands/field stay in sync.
 *
 * Card x/y live on the *float* rectangle: whatever is left after chrome.
 * That float size is derived and stable (always assumes two-seat chrome).
 */

import {
  HAND_DOCK_HEIGHT_PX,
  PLAY_PILE_SIZE,
} from "@/components/Playtester/constants"

/** Design canvas for the whole play row (not just the float surface). */
export const PLAY_FIELD_LOGICAL = {
  width: 1980,
  height: 1080,
} as const

export type FieldSize = {
  width: number
  height: number
}

/** Tailwind `gap-2` × 2 between three columns. */
export const PLAY_BOARD_GAP_X_PX = 16
/** Tailwind `gap-1` × 2 between opp-hand / field / local-hand. */
export const PLAY_BOARD_GAP_Y_PX = 8

/** Two-seat chrome footprint used to size the float (keeps coords stable). */
export const PLAY_BOARD_SIDE_COLUMNS = 2
export const PLAY_BOARD_HAND_STRIPS = 2

function finitePositive(n: number): boolean {
  return Number.isFinite(n) && n > 0
}

/**
 * Float surface size inside the design screen after side piles + hand docks.
 * Card x/y / clamp / pointer mapping all use this, not the full screen.
 */
export function playFloatLogicalSize(
  screen: FieldSize = PLAY_FIELD_LOGICAL,
  pileFaceW: number = PLAY_PILE_SIZE.lg.w,
  handDockPx: number = HAND_DOCK_HEIGHT_PX
): FieldSize {
  return {
    width:
      screen.width -
      PLAY_BOARD_SIDE_COLUMNS * pileFaceW -
      PLAY_BOARD_GAP_X_PX,
    height:
      screen.height -
      PLAY_BOARD_HAND_STRIPS * handDockPx -
      PLAY_BOARD_GAP_Y_PX,
  }
}

/** Cached float size for the current design screen. */
export const PLAY_FLOAT_LOGICAL: FieldSize = playFloatLogicalSize()

/** Scale that fits the design *screen* inside the host box (letterboxed). */
export function playFieldFitScale(
  availWidth: number,
  availHeight: number,
  logical: FieldSize = PLAY_FIELD_LOGICAL
): number {
  if (
    !finitePositive(availWidth) ||
    !finitePositive(availHeight) ||
    !finitePositive(logical.width) ||
    !finitePositive(logical.height)
  ) {
    return 1
  }
  return Math.min(availWidth / logical.width, availHeight / logical.height)
}

/**
 * @deprecated Screen chrome is inside `PLAY_FIELD_LOGICAL` now — use
 * `playFieldFitScale` on the host. Kept so older call sites keep compiling.
 */
export type PlayBoardChrome = {
  handStrips: number
  sideColumns: number
  handDockPx: number
  pileFaceW: number
  gapXPx?: number
  gapYPx?: number
}

/** @deprecated prefer playFieldFitScale(host) */
export function playBoardFitScale(
  availWidth: number,
  availHeight: number,
  _chrome?: PlayBoardChrome,
  logical: FieldSize = PLAY_FIELD_LOGICAL
): number {
  return playFieldFitScale(availWidth, availHeight, logical)
}

/**
 * Map a pointer on the *painted* float rect into shared float logical coords.
 */
export function clientToLogicalField(
  clientX: number,
  clientY: number,
  surfaceRect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  logical: FieldSize = PLAY_FLOAT_LOGICAL
): { x: number; y: number } {
  if (!finitePositive(surfaceRect.width) || !finitePositive(surfaceRect.height)) {
    return { x: 0, y: 0 }
  }
  if (!finitePositive(logical.width) || !finitePositive(logical.height)) {
    return { x: 0, y: 0 }
  }
  return {
    x: ((clientX - surfaceRect.left) / surfaceRect.width) * logical.width,
    y: ((clientY - surfaceRect.top) / surfaceRect.height) * logical.height,
  }
}

/** Painted px per logical float px (for ghosts / fixed overlays). */
export function logicalFieldPaintScale(
  surfaceRect: Pick<DOMRectReadOnly, "width" | "height">,
  logical: FieldSize = PLAY_FLOAT_LOGICAL
): { sx: number; sy: number } {
  return {
    sx:
      finitePositive(surfaceRect.width) && finitePositive(logical.width)
        ? surfaceRect.width / logical.width
        : 1,
    sy:
      finitePositive(surfaceRect.height) && finitePositive(logical.height)
        ? surfaceRect.height / logical.height
        : 1,
  }
}

/**
 * CSS transform scale on an ancestor (board fit-scale) makes layout px and
 * painted px diverge. `offset*` is pre-transform; `getBoundingClientRect` is
 * post-transform — their ratio is the paint scale for portaled ghosts.
 */
export function elementCssPaintScale(
  el: Element | null
): { sx: number; sy: number } {
  if (!(el instanceof HTMLElement)) return { sx: 1, sy: 1 }
  const rect = el.getBoundingClientRect()
  const w = el.offsetWidth
  const h = el.offsetHeight
  return {
    sx: finitePositive(w) ? rect.width / w : 1,
    sy: finitePositive(h) ? rect.height / h : 1,
  }
}
