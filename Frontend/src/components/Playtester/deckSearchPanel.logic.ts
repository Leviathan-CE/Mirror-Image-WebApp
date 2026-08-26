/**
 * Deck search panel box (position + size): clamping plus a localStorage
 * round-trip, so dragging or resizing the panel survives closing it and
 * reloading the playtester.
 */

import {
  DECK_SEARCH_SIZE,
  PLAYTESTER_STORAGE,
} from "@/components/Playtester/constants"
import { safeJsonParse } from "@/lib/utils"

export type DeckSearchBox = {
  x: number
  y: number
  width: number
  height: number
}

export type ViewportSize = {
  width: number
  height: number
}

/** Gap kept between the panel and the window edges. */
const MARGIN_PX = 8
/** Panel height that must stay on screen, so the header is always grabbable. */
const MIN_VISIBLE_PX = 48
/** Default distance from the top of the window. */
const TOP_OFFSET_PX = 32

function clampAxis(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(min, max), Math.max(min, Math.round(value)))
}

/**
 * Fit a box inside the window: size within its bounds (never wider than the
 * window), then position so the panel stays reachable after a window resize.
 */
export function clampDeckSearchBox(
  box: DeckSearchBox,
  viewport: ViewportSize
): DeckSearchBox {
  const width = clampAxis(
    box.width,
    DECK_SEARCH_SIZE.minWidth,
    Math.min(DECK_SEARCH_SIZE.maxWidth, viewport.width - MARGIN_PX * 2),
    DECK_SEARCH_SIZE.defaultWidth
  )
  const height = clampAxis(
    box.height,
    DECK_SEARCH_SIZE.minHeight,
    Math.min(DECK_SEARCH_SIZE.maxHeight, viewport.height - MARGIN_PX * 2),
    DECK_SEARCH_SIZE.defaultHeight
  )
  return {
    width,
    height,
    x: clampAxis(
      box.x,
      MARGIN_PX,
      viewport.width - width - MARGIN_PX,
      (viewport.width - width) / 2
    ),
    y: clampAxis(
      box.y,
      MARGIN_PX,
      viewport.height - MIN_VISIBLE_PX,
      TOP_OFFSET_PX
    ),
  }
}

/** Default box: default size, horizontally centred, near the top. */
export function defaultDeckSearchBox(viewport: ViewportSize): DeckSearchBox {
  return clampDeckSearchBox(
    {
      x: (viewport.width - DECK_SEARCH_SIZE.defaultWidth) / 2,
      y: TOP_OFFSET_PX,
      width: DECK_SEARCH_SIZE.defaultWidth,
      height: DECK_SEARCH_SIZE.defaultHeight,
    },
    viewport
  )
}

/** Current window size, or a sane box when there is no window (SSR / tests). */
export function currentViewport(): ViewportSize {
  if (typeof window === "undefined") return { width: 1280, height: 800 }
  return { width: window.innerWidth, height: window.innerHeight }
}

/** Stored box fitted to the window, or the default when absent / unusable. */
export function readStoredDeckSearchBox(viewport: ViewportSize): DeckSearchBox {
  try {
    const raw = window.localStorage.getItem(PLAYTESTER_STORAGE.deckSearchBoxPx)
    if (!raw) return defaultDeckSearchBox(viewport)
    const parsed = safeJsonParse(raw)
    if (!parsed || typeof parsed !== "object") {
      return defaultDeckSearchBox(viewport)
    }
    const row = parsed as Partial<DeckSearchBox>
    const fallback = defaultDeckSearchBox(viewport)
    return clampDeckSearchBox(
      {
        x: Number.isFinite(Number(row.x)) ? Number(row.x) : fallback.x,
        y: Number.isFinite(Number(row.y)) ? Number(row.y) : fallback.y,
        width: Number(row.width),
        height: Number(row.height),
      },
      viewport
    )
  } catch {
    return defaultDeckSearchBox(viewport)
  }
}

export function writeStoredDeckSearchBox(box: DeckSearchBox): void {
  try {
    window.localStorage.setItem(
      PLAYTESTER_STORAGE.deckSearchBoxPx,
      JSON.stringify(box)
    )
  } catch {
    /* storage unavailable (private mode / quota) — box stays session-only */
  }
}

/** Same clamp/default helpers; separate storage key for trash / dismantled browser. */
export function readStoredFaceUpPileBrowserBox(
  viewport: ViewportSize
): DeckSearchBox {
  try {
    const raw = window.localStorage.getItem(
      PLAYTESTER_STORAGE.faceUpPileBrowserBoxPx
    )
    if (!raw) return defaultDeckSearchBox(viewport)
    const parsed = safeJsonParse(raw)
    if (!parsed || typeof parsed !== "object") {
      return defaultDeckSearchBox(viewport)
    }
    const row = parsed as Partial<DeckSearchBox>
    const fallback = defaultDeckSearchBox(viewport)
    return clampDeckSearchBox(
      {
        x: Number.isFinite(Number(row.x)) ? Number(row.x) : fallback.x,
        y: Number.isFinite(Number(row.y)) ? Number(row.y) : fallback.y,
        width: Number(row.width),
        height: Number(row.height),
      },
      viewport
    )
  } catch {
    return defaultDeckSearchBox(viewport)
  }
}

export function writeStoredFaceUpPileBrowserBox(box: DeckSearchBox): void {
  try {
    window.localStorage.setItem(
      PLAYTESTER_STORAGE.faceUpPileBrowserBoxPx,
      JSON.stringify(box)
    )
  } catch {
    /* storage unavailable */
  }
}
