import { describe, expect, it } from "vitest"

import {
  clampHandFloatBox,
  defaultHandFloatBox,
  readStoredHandFloatBox,
  writeStoredHandFloatBox,
} from "@/components/Playtester/board/handFloatPanel.logic"
import {
  HAND_FLOAT_SIZE,
  PLAYTESTER_STORAGE,
} from "@/components/Playtester/constants"

const parent = { width: 900, height: 500 }

describe("handFloatPanel.logic", () => {
  it("sits the default local box on the bottom edge", () => {
    const box = defaultHandFloatBox(parent, "bottom")
    expect(box.width).toBe(HAND_FLOAT_SIZE.defaultWidth)
    expect(box.height).toBe(HAND_FLOAT_SIZE.defaultHeight)
    expect(box.x).toBe((parent.width - HAND_FLOAT_SIZE.defaultWidth) / 2)
    expect(box.y).toBe(parent.height - HAND_FLOAT_SIZE.defaultHeight - 8)
  })

  it("sits the default opponent box on the top edge", () => {
    const box = defaultHandFloatBox(parent, "top")
    expect(box.y).toBe(8)
  })

  it("clamps size into its bounds", () => {
    const small = clampHandFloatBox(
      { x: 100, y: 100, width: 10, height: 10 },
      parent
    )
    expect(small.width).toBe(HAND_FLOAT_SIZE.minWidth)
    expect(small.height).toBe(HAND_FLOAT_SIZE.minHeight)
  })

  it("never sizes the window wider than the parent", () => {
    const box = clampHandFloatBox(
      { x: 0, y: 0, width: 99999, height: 99999 },
      { width: 400, height: 300 }
    )
    expect(box.width).toBe(400 - 16)
    expect(box.height).toBe(300 - 16)
  })

  it("round-trips a stored local box", () => {
    writeStoredHandFloatBox({ x: 40, y: 80, width: 500, height: 200 }, "bottom")
    expect(readStoredHandFloatBox(parent, "bottom")).toEqual({
      x: 40,
      y: 80,
      width: 500,
      height: 200,
    })
  })

  it("reads the default when storage is junk", () => {
    window.localStorage.setItem(PLAYTESTER_STORAGE.handBoxPx, "not json")
    expect(readStoredHandFloatBox(parent, "bottom")).toEqual(
      defaultHandFloatBox(parent, "bottom")
    )
  })
})
