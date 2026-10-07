/**
 * MTG Arena-style hover preview placement.
 * The big face sits beside the card (above a hand card) and does not cover it.
 */

export type AnchorBox = {
  left: number
  top: number
  right: number
  bottom: number
}

export type PreviewBox = {
  left: number
  top: number
  width: number
  height: number
}

const PAD = 12
const GAP = 16
const WIDTH_OVER_HEIGHT = 5 / 7

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

export function planArenaHoverPreview(
  anchor: AnchorBox,
  viewportWidth: number,
  viewportHeight: number
): PreviewBox {
  const maxHeight = Math.min(viewportHeight - PAD * 2, viewportHeight * 0.72, 760)
  const maxWidth = Math.min(viewportWidth - PAD * 2, viewportWidth * 0.48)
  let height = maxHeight
  let width = height * WIDTH_OVER_HEIGHT
  if (width > maxWidth) {
    width = maxWidth
    height = width / WIDTH_OVER_HEIGHT
  }

  const spaceLeft = anchor.left - PAD
  const spaceRight = viewportWidth - anchor.right - PAD
  const spaceAbove = anchor.top - PAD
  const handLike = anchor.bottom > viewportHeight * 0.72 && spaceAbove >= 160

  let left: number
  let top = (anchor.top + anchor.bottom) / 2 - height / 2

  if (handLike) {
    const room = Math.max(160, anchor.top - PAD - GAP)
    if (room < height) {
      height = room
      width = height * WIDTH_OVER_HEIGHT
    }
    top = anchor.top - GAP - height
    left = (anchor.left + anchor.right) / 2 - width / 2
  } else if (spaceRight >= width + GAP || spaceRight >= spaceLeft) {
    left = anchor.right + GAP
  } else {
    left = anchor.left - GAP - width
  }

  left = clamp(left, PAD, Math.max(PAD, viewportWidth - width - PAD))
  top = clamp(top, PAD, Math.max(PAD, viewportHeight - height - PAD))
  return { left, top, width, height }
}
