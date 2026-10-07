import { describe, expect, it } from "vitest"

import {
  DRAG_THRESHOLD_COARSE_PX,
  DRAG_THRESHOLD_FINE_PX,
  dragThresholdPx,
  longPressShouldCancel,
} from "@/components/Playtester/board/touchPlay.logic"

describe("dragThresholdPx", () => {
  it("keeps the fine threshold for mouse-like pointers", () => {
    expect(dragThresholdPx(false)).toBe(DRAG_THRESHOLD_FINE_PX)
  })

  it("raises the threshold for coarse pointers", () => {
    expect(dragThresholdPx(true)).toBe(DRAG_THRESHOLD_COARSE_PX)
    expect(dragThresholdPx(true)).toBeGreaterThan(dragThresholdPx(false))
  })
})

describe("longPressShouldCancel", () => {
  it("stays armed for small jitter", () => {
    expect(longPressShouldCancel(100, 100, 105, 102)).toBe(false)
  })

  it("cancels once movement exceeds the cancel radius", () => {
    expect(longPressShouldCancel(100, 100, 120, 100)).toBe(true)
  })

  it("cancels on non-finite coords", () => {
    expect(longPressShouldCancel(Number.NaN, 0, 0, 0)).toBe(true)
  })
})
