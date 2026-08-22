import { describe, expect, it } from "vitest"

import {
  clampDeckSearchBox,
  defaultDeckSearchBox,
  readStoredDeckSearchBox,
  writeStoredDeckSearchBox,
} from "@/components/Playtester/deckSearchPanel.logic"
import {
  DECK_SEARCH_SIZE,
  PLAYTESTER_STORAGE,
} from "@/components/Playtester/constants"

const viewport = { width: 1280, height: 800 }

describe("deckSearchPanel.logic", () => {
  it("centres the default box near the top of the window", () => {
    const box = defaultDeckSearchBox(viewport)
    expect(box.width).toBe(DECK_SEARCH_SIZE.defaultWidth)
    expect(box.height).toBe(DECK_SEARCH_SIZE.defaultHeight)
    expect(box.x).toBe((viewport.width - DECK_SEARCH_SIZE.defaultWidth) / 2)
    expect(box.y).toBe(32)
  })

  it("clamps size into its bounds and rounds", () => {
    const small = clampDeckSearchBox(
      { x: 100, y: 100, width: 10, height: 10 },
      viewport
    )
    expect(small.width).toBe(DECK_SEARCH_SIZE.minWidth)
    expect(small.height).toBe(DECK_SEARCH_SIZE.minHeight)

    const rounded = clampDeckSearchBox(
      { x: 10.4, y: 10.6, width: 400.6, height: 500.2 },
      viewport
    )
    expect(rounded).toEqual({ x: 10, y: 11, width: 401, height: 500 })
  })

  it("never sizes the panel wider or taller than the window", () => {
    const box = clampDeckSearchBox(
      { x: 0, y: 0, width: 99999, height: 99999 },
      { width: 500, height: 400 }
    )
    expect(box.width).toBe(500 - 16)
    expect(box.height).toBe(400 - 16)
  })

  it("pulls an off-screen box back into view", () => {
    const box = clampDeckSearchBox(
      { x: 5000, y: 5000, width: 400, height: 300 },
      viewport
    )
    expect(box.x).toBe(viewport.width - 400 - 8)
    expect(box.y).toBe(viewport.height - 48)
    expect(clampDeckSearchBox({ ...box, x: -200, y: -200 }, viewport)).toEqual({
      ...box,
      x: 8,
      y: 8,
    })
  })

  it("falls back to the default for non-finite values", () => {
    expect(
      clampDeckSearchBox(
        { x: NaN, y: NaN, width: NaN, height: NaN },
        viewport
      )
    ).toEqual(defaultDeckSearchBox(viewport))
  })

  it("round-trips a stored box", () => {
    writeStoredDeckSearchBox({ x: 120, y: 60, width: 600, height: 500 })
    expect(readStoredDeckSearchBox(viewport)).toEqual({
      x: 120,
      y: 60,
      width: 600,
      height: 500,
    })
  })

  it("reads the default when nothing is stored or the value is junk", () => {
    expect(readStoredDeckSearchBox(viewport)).toEqual(
      defaultDeckSearchBox(viewport)
    )
    window.localStorage.setItem(PLAYTESTER_STORAGE.deckSearchBoxPx, "not json")
    expect(readStoredDeckSearchBox(viewport)).toEqual(
      defaultDeckSearchBox(viewport)
    )
  })

  it("refits a stored box saved on a bigger window", () => {
    writeStoredDeckSearchBox({ x: 1100, y: 700, width: 900, height: 700 })
    const box = readStoredDeckSearchBox({ width: 600, height: 500 })
    expect(box.width).toBe(600 - 16)
    expect(box.x).toBe(8)
    expect(box.y).toBe(500 - 48)
  })
})
