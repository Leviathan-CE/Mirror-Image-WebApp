import { describe, expect, it } from "vitest"

import {
  PILE_COLUMN_SCALE_MIN,
  SIDE_COLUMN_PILE_COUNT,
  SOLO_LIFE_BLOCK_PX,
  pileColumnScale,
  scalePlayPile,
  sideColumnHeightAfterScale,
  sideColumnNaturalHeightPx,
  soloPlayPileScale,
} from "@/components/Playtester/board/playPileScale.logic"
import { PLAY_PILE_SIZE } from "@/components/Playtester/constants"

describe("playPileScale.logic", () => {
  it("keeps full size when the row is taller than the column", () => {
    const natural = sideColumnNaturalHeightPx()
    expect(pileColumnScale(natural + 200)).toBe(1)
  })

  it("shrinks faces so scaled height fits inside available", () => {
    const available = sideColumnNaturalHeightPx() * 0.7
    const scale = pileColumnScale(available)
    expect(scale).toBeLessThan(1)
    expect(sideColumnHeightAfterScale(scale)).toBeLessThanOrEqual(
      available + 0.5
    )
  })

  it("does not treat labels as if they shrink (avoids under-shrink)", () => {
    const available = 520
    const scale = pileColumnScale(available)
    // Old bug: available/natural left the real column taller than available.
    expect(sideColumnHeightAfterScale(scale)).toBeLessThanOrEqual(
      available + 0.5
    )
  })

  it("does not shrink past the minimum", () => {
    expect(pileColumnScale(10)).toBe(PILE_COLUMN_SCALE_MIN)
  })

  it("defaults to full size before the row is measured", () => {
    expect(pileColumnScale(0)).toBe(1)
  })

  it("scales an lg face while keeping 3:4", () => {
    const scaled = scalePlayPile("lg", 0.5)
    expect(scaled.w).toBe(Math.round(PLAY_PILE_SIZE.lg.w * 0.5))
    expect(scaled.h).toBe(Math.round(PLAY_PILE_SIZE.lg.h * 0.5))
    expect(scaled.w / scaled.h).toBeCloseTo(
      PLAY_PILE_SIZE.lg.w / PLAY_PILE_SIZE.lg.h,
      2
    )
  })

  it("sizes the natural column for three piles", () => {
    expect(SIDE_COLUMN_PILE_COUNT).toBe(3)
    expect(sideColumnNaturalHeightPx()).toBeGreaterThan(PLAY_PILE_SIZE.lg.h * 3)
  })

  it("keeps solo piles full size on a desktop host", () => {
    expect(soloPlayPileScale(1400, 900)).toBe(1)
    expect(soloPlayPileScale(0, 0)).toBe(1)
  })

  it("shrinks solo piles so the life counter and three faces fit a short phone", () => {
    const hostH = 520
    const scale = soloPlayPileScale(800, hostH)
    expect(scale).toBeLessThan(1)
    expect(
      sideColumnHeightAfterScale(scale) + SOLO_LIFE_BLOCK_PX
    ).toBeLessThanOrEqual(hostH + 0.5)
  })

  it("shrinks solo columns so two of them leave field width on a narrow phone", () => {
    const hostW = 360
    const scale = soloPlayPileScale(hostW, 800)
    const columnW = scalePlayPile("lg", scale).w
    expect(columnW).toBeLessThanOrEqual((hostW - 16) * 0.3 + 1)
  })
})
