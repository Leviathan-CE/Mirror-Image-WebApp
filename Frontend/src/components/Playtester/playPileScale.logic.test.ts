import { describe, expect, it } from "vitest"

import {
  PILE_COLUMN_SCALE_MIN,
  SIDE_COLUMN_PILE_COUNT,
  pileColumnScale,
  scalePlayPile,
  sideColumnHeightAfterScale,
  sideColumnNaturalHeightPx,
} from "@/components/Playtester/playPileScale.logic"
import { PLAY_PILE_SIZE } from "@/components/Playtester/playtesterConstants"

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

  it("sizes the natural column for four piles", () => {
    expect(SIDE_COLUMN_PILE_COUNT).toBe(4)
    expect(sideColumnNaturalHeightPx()).toBeGreaterThan(PLAY_PILE_SIZE.lg.h * 4)
  })
})
