/**
 * Side-column piles (deck / trash / dismantled) are a fixed stack of `lg`
 * faces. On a short viewport that stack is taller than the play row and the
 * top clips. One scale factor shrinks every face so the column fits the
 * measured row height.
 *
 * Important: labels / gaps / padding do **not** shrink with the face. Scale
 * only the face stack, or the column stays taller than `available` and still
 * clips (classic "scale looks right on paper, top pile still cut off" bug).
 */

import {
  PLAY_PILE_SIZE,
  type PlayPileSize,
} from "@/components/Playtester/constants"

/** How many piles sit in one side column (deck / trash / dismantled). */
export const SIDE_COLUMN_PILE_COUNT = 3

/** Label under each pile (text-[10px] + mt-1). Does not scale with the face. */
export const LABEL_H_PX = 20

/** Tailwind `gap-1` + `py-1` chrome around the stack. Fixed, not scaled. */
export const COLUMN_GAP_PX = 4
export const COLUMN_PAD_Y_PX = 8
/** Extra slack so font metrics / subpixels do not leave the pilot 1–2px clipped. */
export const COLUMN_FIT_SLACK_PX = 8

/**
 * Floor so faces stay tappable. Low enough that a ~500px-tall play row can
 * still fit three piles once labels/gaps are reserved.
 */
export const PILE_COLUMN_SCALE_MIN = 0.38

export type ScaledPlayPile = {
  w: number
  h: number
  peek: number
}

/** Fixed chrome (labels + gaps + pad) that never shrinks with `scale`. */
export function sideColumnFixedChromePx(
  pileCount: number = SIDE_COLUMN_PILE_COUNT
): number {
  const gaps = Math.max(0, pileCount - 1) * COLUMN_GAP_PX
  return pileCount * LABEL_H_PX + gaps + COLUMN_PAD_Y_PX + COLUMN_FIT_SLACK_PX
}

/** Natural (unscaled) height of one side column. */
export function sideColumnNaturalHeightPx(
  pileCount: number = SIDE_COLUMN_PILE_COUNT,
  faceH: number = PLAY_PILE_SIZE.lg.h
): number {
  return pileCount * faceH + sideColumnFixedChromePx(pileCount)
}

/**
 * Height of the column after applying `scale` to faces only.
 * `sideColumnHeightAfterScale(s) <= available` is what `pileColumnScale` solves.
 */
export function sideColumnHeightAfterScale(
  scale: number,
  pileCount: number = SIDE_COLUMN_PILE_COUNT,
  faceH: number = PLAY_PILE_SIZE.lg.h
): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return pileCount * faceH * s + sideColumnFixedChromePx(pileCount)
}

/**
 * Scale in [PILE_COLUMN_SCALE_MIN, 1] so scaled faces + fixed chrome fit
 * `available`. Missing / zero available → 1 (full size until measured).
 */
export function pileColumnScale(
  availableHeightPx: number,
  pileCount: number = SIDE_COLUMN_PILE_COUNT
): number {
  if (!Number.isFinite(availableHeightPx) || availableHeightPx <= 0) return 1
  const faceH = PLAY_PILE_SIZE.lg.h
  const faceStack = pileCount * faceH
  if (faceStack <= 0) return 1
  const faceBudget = availableHeightPx - sideColumnFixedChromePx(pileCount)
  if (faceBudget <= 0) return PILE_COLUMN_SCALE_MIN
  return Math.min(1, Math.max(PILE_COLUMN_SCALE_MIN, faceBudget / faceStack))
}

/**
 * Life counter, its margin, and the gap above the three card piles.
 * `pileColumnScale` only budgets the three faces, so this extra block has to
 * come out of the host height first or the top of the column still clips.
 */
export const SOLO_LIFE_BLOCK_PX = 52

/** Each side column may take at most this share of a narrow host. */
const SOLO_COLUMN_WIDTH_FRACTION = 0.3

/**
 * Solo playtester scale. Desktop hosts stay at 1. A short or narrow phone
 * shrinks pile faces and battlefield cards together so the column fits the
 * screen and two columns do not cover the whole width.
 */
export function soloPlayPileScale(
  hostWidthPx: number,
  hostHeightPx: number
): number {
  if (!Number.isFinite(hostWidthPx) || hostWidthPx <= 0) return 1
  if (!Number.isFinite(hostHeightPx) || hostHeightPx <= 0) return 1

  const byHeight = pileColumnScale(hostHeightPx - SOLO_LIFE_BLOCK_PX)
  const columnBudget = Math.max(
    1,
    (hostWidthPx - 16) * SOLO_COLUMN_WIDTH_FRACTION
  )
  const byWidth = columnBudget / PLAY_PILE_SIZE.lg.w
  const scale = Math.min(byHeight, byWidth)
  if (!Number.isFinite(scale)) return 1
  return Math.min(1, Math.max(PILE_COLUMN_SCALE_MIN, scale))
}

export function scalePlayPile(
  size: PlayPileSize,
  scale: number
): ScaledPlayPile {
  const base = PLAY_PILE_SIZE[size]
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return {
    w: Math.max(1, Math.round(base.w * s)),
    h: Math.max(1, Math.round(base.h * s)),
    peek: Math.max(1, Math.round(base.peek * s)),
  }
}
