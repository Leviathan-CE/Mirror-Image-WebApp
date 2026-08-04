import { describe, expect, it } from "vitest"

import {
  clampMenuPosition,
  planSubmenuFixedPosition,
} from "./contextMenuPosition.logic"

describe("clampMenuPosition", () => {
  it("keeps the click point when the menu fits", () => {
    expect(clampMenuPosition(100, 80, 160, 200, 800, 600)).toEqual({
      left: 100,
      top: 80,
    })
  })

  it("pushes left/up when near the bottom-right edge", () => {
    expect(clampMenuPosition(750, 550, 160, 200, 800, 600, 8)).toEqual({
      left: 800 - 160 - 8,
      top: 600 - 200 - 8,
    })
  })

  it("pins to padding when the menu is larger than the viewport", () => {
    expect(clampMenuPosition(10, 10, 900, 700, 800, 600, 8)).toEqual({
      left: 8,
      top: 8,
    })
  })
})

describe("planSubmenuFixedPosition", () => {
  it("opens to the right when there is room", () => {
    expect(
      planSubmenuFixedPosition(
        { left: 100, right: 260, top: 120 },
        { width: 144, height: 120 },
        800,
        600
      )
    ).toEqual({ side: "right", left: 264, top: 120 })
  })

  it("flips to the left when the right side would clip", () => {
    expect(
      planSubmenuFixedPosition(
        { left: 600, right: 760, top: 120 },
        { width: 144, height: 120 },
        800,
        600
      )
    ).toEqual({
      side: "left",
      left: 600 - 4 - 144,
      top: 120,
    })
  })

  it("nudges the flyout up when it would clip the bottom", () => {
    const placement = planSubmenuFixedPosition(
      { left: 100, right: 260, top: 520 },
      { width: 144, height: 160 },
      800,
      600,
      8
    )
    expect(placement.side).toBe("right")
    expect(placement.top + 160).toBeLessThanOrEqual(600 - 8)
  })
})
