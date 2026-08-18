/**
 * Hand cards fill the window's height (minus chrome) and keep a 3:4 aspect.
 * Width of the window only changes how many cards you see before scrolling.
 */

import { HAND_CARD_SIZE } from "@/components/Playtester/playtesterConstants"

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
