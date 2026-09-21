import { describe, expect, it } from "vitest"

import {
  PLAY_FIELD_LOGICAL,
  PLAY_FLOAT_LOGICAL,
  clientToLogicalField,
  logicalFieldPaintScale,
  playFieldFitScale,
  playFloatLogicalSize,
} from "@/components/Playtester/board/playFieldScale.logic"

describe("playFieldFitScale", () => {
  it("is 1 when the host matches the design screen", () => {
    expect(
      playFieldFitScale(
        PLAY_FIELD_LOGICAL.width,
        PLAY_FIELD_LOGICAL.height
      )
    ).toBe(1)
  })

  it("grows when the host is larger", () => {
    expect(
      playFieldFitScale(
        PLAY_FIELD_LOGICAL.width * 2,
        PLAY_FIELD_LOGICAL.height * 2
      )
    ).toBe(2)
  })

  it("can cap enlargement for shared rooms", () => {
    expect(
      playFieldFitScale(
        PLAY_FIELD_LOGICAL.width * 2,
        PLAY_FIELD_LOGICAL.height * 2,
        PLAY_FIELD_LOGICAL,
        1
      )
    ).toBe(1)
  })

  it("still shrinks under a maxScale cap", () => {
    expect(
      playFieldFitScale(
        PLAY_FIELD_LOGICAL.width / 2,
        PLAY_FIELD_LOGICAL.height,
        PLAY_FIELD_LOGICAL,
        1
      )
    ).toBeCloseTo(0.5, 5)
  })

  it("shrinks to the tighter axis on a small host", () => {
    expect(
      playFieldFitScale(PLAY_FIELD_LOGICAL.width / 2, PLAY_FIELD_LOGICAL.height)
    ).toBeCloseTo(0.5, 5)
  })

  it("defaults to 1 before the host is measured", () => {
    expect(playFieldFitScale(0, 0)).toBe(1)
  })
})

describe("playFloatLogicalSize", () => {
  it("matches the design screen (chrome overlays the float)", () => {
    const float = playFloatLogicalSize()
    expect(float).toEqual({
      width: PLAY_FIELD_LOGICAL.width,
      height: PLAY_FIELD_LOGICAL.height,
    })
    expect(PLAY_FLOAT_LOGICAL).toEqual(float)
  })

  it("follows a custom screen size", () => {
    expect(playFloatLogicalSize({ width: 800, height: 600 })).toEqual({
      width: 800,
      height: 600,
    })
  })
})

describe("clientToLogicalField", () => {
  const rect = {
    left: 100,
    top: 50,
    width: PLAY_FLOAT_LOGICAL.width / 2,
    height: PLAY_FLOAT_LOGICAL.height / 2,
  }

  it("maps the painted float rect onto PLAY_FLOAT_LOGICAL", () => {
    expect(
      clientToLogicalField(
        100 + rect.width / 2,
        50 + rect.height / 2,
        rect
      )
    ).toEqual({
      x: PLAY_FLOAT_LOGICAL.width / 2,
      y: PLAY_FLOAT_LOGICAL.height / 2,
    })
  })

  it("keeps board fractions equal across paint sizes", () => {
    const small = {
      left: 0,
      top: 0,
      width: PLAY_FLOAT_LOGICAL.width / 4,
      height: PLAY_FLOAT_LOGICAL.height / 4,
    }
    const large = {
      left: 0,
      top: 0,
      width: PLAY_FLOAT_LOGICAL.width,
      height: PLAY_FLOAT_LOGICAL.height,
    }
    const a = clientToLogicalField(small.width * 0.25, 0, small)
    const b = clientToLogicalField(large.width * 0.25, 0, large)
    expect(a.x).toBeCloseTo(b.x, 5)
    expect(a.x).toBeCloseTo(PLAY_FLOAT_LOGICAL.width * 0.25, 5)
  })

  it("reports paint scale as painted/logical float", () => {
    expect(logicalFieldPaintScale(rect)).toEqual({ sx: 0.5, sy: 0.5 })
  })
})
