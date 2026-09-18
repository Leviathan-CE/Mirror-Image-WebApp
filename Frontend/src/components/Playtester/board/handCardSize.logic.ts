/**
 * Hand cards fill the window's height (minus chrome) and keep a 3:4 aspect.
 * Width of the window only changes how many cards you see before scrolling.
 */

import { HAND_CARD_SIZE } from "@/components/Playtester/constants"

export type HandCardPx = {
  width: number
  height: number
}

const ASPECT =
  HAND_CARD_SIZE.defaultWidth / HAND_CARD_SIZE.defaultHeight

function clampHeight(value: number): number {
  return Math.min(
    HAND_CARD_SIZE.maxHeight,
    Math.max(HAND_CARD_SIZE.minHeight, Math.round(value))
  )
}

export function handCardSizePx(hostHeight: number): HandCardPx {
  if (!Number.isFinite(hostHeight) || hostHeight <= 0) {
    return {
      width: HAND_CARD_SIZE.defaultWidth,
      height: HAND_CARD_SIZE.defaultHeight,
    }
  }
  const height = clampHeight(hostHeight - HAND_CARD_SIZE.chromeY)
  return {
    width: Math.round(height * ASPECT),
    height,
  }
}

/**
 * Map a logical card footprint onto painted (on-screen) pixels.
 * CSS `transform: scale()` on raster art is what makes peek cards look soft —
 * size the overlay in this space instead of shrinking a larger bitmap.
 */
export function scaleHandCardPx(
  size: HandCardPx,
  sx: number,
  sy: number
): HandCardPx {
  if (!Number.isFinite(sx) || sx <= 0) return size
  if (!Number.isFinite(sy) || sy <= 0) return size
  return {
    width: Math.round(size.width * sx),
    height: Math.round(size.height * sy),
  }
}

export type PeekPortalDock = {
  left: number
  top: number
  width: number
  bottom: number
}

/** Remote inspection wins; otherwise the local pointer index. */
export function shownHandHoverIndex(
  remoteIndex: number | null | undefined,
  localIndex: number | null
): number | null {
  if (remoteIndex != null) return remoteIndex
  return localIndex
}

/**
 * Slot + face size when the overlay stays a sliver and only the inspected
 * card nudges out. The face stays full-size and cropped — `nudgePx` is extra
 * crop height, not a full-card reveal.
 */
export function peekStickOutSlot(args: {
  hovered: boolean
  sliverPx: number
  card: HandCardPx
  nudgePx: number
}): {
  slotW: number
  slotH: number
  faceW: number
  faceH: number
} {
  const sliver =
    Number.isFinite(args.sliverPx) && args.sliverPx > 0
      ? Math.round(args.sliverPx)
      : args.card.height
  const nudge =
    args.hovered && Number.isFinite(args.nudgePx) && args.nudgePx > 0
      ? Math.round(args.nudgePx)
      : 0
  return {
    slotW: args.card.width,
    slotH: sliver + nudge,
    faceW: args.card.width,
    faceH: args.card.height,
  }
}

/**
 * Screen-space box for the peek overlay. Animate `top`/`height` — a parent
 * `transform` (even `translateY(0)`) rasterizes the row at 1× on many
 * Windows DPR scales and the art goes soft again.
 *
 * `stickOutNudgePx` (logical) adds a small peek past the sliver so you can
 * tell which opponent card is inspected without sliding the whole face out.
 */
export function peekPortalBox(args: {
  dock: PeekPortalDock
  anchor: "top" | "bottom"
  collapsedPx: number
  expandedPx: number
  expanded: boolean
  sy: number
  hoverScale: number
  stickOutNudgePx?: number
}): {
  left: number
  top: number
  paintedWidth: number
  paintedHeight: number
} {
  const sy = Number.isFinite(args.sy) && args.sy > 0 ? args.sy : 1
  const hover =
    args.expanded && Number.isFinite(args.hoverScale) && args.hoverScale > 1
      ? args.hoverScale
      : 1
  let logicalH = args.collapsedPx
  if (args.expanded) {
    logicalH = args.expandedPx * hover
  } else if (
    args.stickOutNudgePx != null &&
    Number.isFinite(args.stickOutNudgePx) &&
    args.stickOutNudgePx > 0
  ) {
    logicalH = args.collapsedPx + args.stickOutNudgePx
  }
  const paintedHeight = logicalH * sy
  if (args.anchor === "bottom") {
    return {
      left: args.dock.left,
      top: args.dock.bottom - paintedHeight,
      paintedWidth: args.dock.width,
      paintedHeight,
    }
  }
  return {
    left: args.dock.left,
    top: args.dock.top,
    paintedWidth: args.dock.width,
    paintedHeight,
  }
}


