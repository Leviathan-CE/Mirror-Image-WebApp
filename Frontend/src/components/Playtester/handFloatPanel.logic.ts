/**
 * Floating hand window box (position + size): clamping plus a localStorage
 * round-trip, so dragging or resizing survives a reload.
 */

import {
  HAND_FLOAT_SIZE,
  PLAYTESTER_STORAGE,
} from "@/components/Playtester/constants"

export type HandFloatBox = {
  x: number
  y: number
  width: number
  height: number
}

export type ParentSize = {
  width: number
  height: number
}

export type HandFloatAnchor = "top" | "bottom"

const MARGIN_PX = 8
const MIN_VISIBLE_PX = 32

function clampAxis(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(min, max), Math.max(min, Math.round(value)))
}

export function clampHandFloatBox(
  box: HandFloatBox,
  parent: ParentSize
): HandFloatBox {
  const width = clampAxis(
    box.width,
    HAND_FLOAT_SIZE.minWidth,
    Math.min(HAND_FLOAT_SIZE.maxWidth, Math.max(HAND_FLOAT_SIZE.minWidth, parent.width - MARGIN_PX * 2)),
    HAND_FLOAT_SIZE.defaultWidth
  )
  const height = clampAxis(
    box.height,
    HAND_FLOAT_SIZE.minHeight,
    Math.min(HAND_FLOAT_SIZE.maxHeight, Math.max(HAND_FLOAT_SIZE.minHeight, parent.height - MARGIN_PX * 2)),
    HAND_FLOAT_SIZE.defaultHeight
  )
  return {
    width,
    height,
    x: clampAxis(
      box.x,
      MARGIN_PX,
      Math.max(MARGIN_PX, parent.width - width - MARGIN_PX),
      MARGIN_PX
    ),
    y: clampAxis(
      box.y,
      MARGIN_PX,
      Math.max(MARGIN_PX, parent.height - MIN_VISIBLE_PX),
      MARGIN_PX
    ),
  }
}

export function defaultHandFloatBox(
  parent: ParentSize,
  anchor: HandFloatAnchor = "bottom"
): HandFloatBox {
  const width = Math.min(
    HAND_FLOAT_SIZE.defaultWidth,
    Math.max(HAND_FLOAT_SIZE.minWidth, parent.width - MARGIN_PX * 2)
  )
  const height = Math.min(
    HAND_FLOAT_SIZE.defaultHeight,
    Math.max(HAND_FLOAT_SIZE.minHeight, parent.height - MARGIN_PX * 2)
  )
  const x = Math.max(MARGIN_PX, (parent.width - width) / 2)
  const y =
    anchor === "top"
      ? MARGIN_PX
      : Math.max(MARGIN_PX, parent.height - height - MARGIN_PX)
  return clampHandFloatBox({ x, y, width, height }, parent)
}

function storageKey(anchor: HandFloatAnchor): string {
  return anchor === "top"
    ? PLAYTESTER_STORAGE.oppHandBoxPx
    : PLAYTESTER_STORAGE.handBoxPx
}

export function readStoredHandFloatBox(
  parent: ParentSize,
  anchor: HandFloatAnchor = "bottom"
): HandFloatBox {
  const fallback = defaultHandFloatBox(parent, anchor)
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(storageKey(anchor))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<HandFloatBox> | null
    if (!parsed || typeof parsed !== "object") return fallback
    return clampHandFloatBox(
      {
        x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : fallback.x,
        y: Number.isFinite(Number(parsed.y)) ? Number(parsed.y) : fallback.y,
        width: Number(parsed.width),
        height: Number(parsed.height),
      },
      parent
    )
  } catch {
    return fallback
  }
}

export function writeStoredHandFloatBox(
  box: HandFloatBox,
  anchor: HandFloatAnchor = "bottom"
): void {
  try {
    window.localStorage.setItem(storageKey(anchor), JSON.stringify(box))
  } catch {
    /* private mode / quota */
  }
}
