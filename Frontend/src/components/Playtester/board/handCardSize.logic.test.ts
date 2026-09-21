import { describe, expect, it } from "vitest"

import {
  handCardSizePx,
  peekPortalBox,
  peekStickOutSlot,
  scaleHandCardPx,
  shownHandHoverIndex,
} from "@/components/Playtester/board/handCardSize.logic"
import { HAND_CARD_SIZE } from "@/components/Playtester/constants"

describe("handCardSizePx", () => {
  it("uses the default footprint when the host has no size yet", () => {
    expect(handCardSizePx(0)).toEqual({
      width: HAND_CARD_SIZE.defaultWidth,
      height: HAND_CARD_SIZE.defaultHeight,
    })
  })

  it("fills the host height after chrome", () => {
    const host = 176
    const size = handCardSizePx(host)
    expect(size.height).toBe(host - HAND_CARD_SIZE.chromeY)
    expect(size.width / size.height).toBeCloseTo(
      HAND_CARD_SIZE.defaultWidth / HAND_CARD_SIZE.defaultHeight
    )
  })

  it("does not shrink below the minimum", () => {
    expect(handCardSizePx(40).height).toBe(HAND_CARD_SIZE.minHeight)
  })

  it("does not grow past the maximum", () => {
    expect(handCardSizePx(2000).height).toBe(HAND_CARD_SIZE.maxHeight)
  })
})

describe("scaleHandCardPx", () => {
  it("rounds painted size from logical × paint scale", () => {
    expect(scaleHandCardPx({ width: 171, height: 228 }, 0.5, 0.5)).toEqual({
      width: 86,
      height: 114,
    })
  })

  it("keeps the logical size when the paint scale is missing", () => {
    expect(scaleHandCardPx({ width: 96, height: 128 }, 0, 1)).toEqual({
      width: 96,
      height: 128,
    })
  })
})

describe("shownHandHoverIndex", () => {
  it("uses the local index when the peer is not inspecting", () => {
    expect(shownHandHoverIndex(null, 2)).toBe(2)
    expect(shownHandHoverIndex(undefined, 2)).toBe(2)
  })

  it("uses the peer index, including slot 0", () => {
    expect(shownHandHoverIndex(0, 4)).toBe(0)
    expect(shownHandHoverIndex(3, 1)).toBe(3)
  })
})

describe("peekStickOutSlot", () => {
  const card = { width: 100, height: 200 }

  it("crops idle cards to the sliver", () => {
    expect(
      peekStickOutSlot({
        hovered: false,
        sliverPx: 64,
        card,
        nudgePx: 20,
      })
    ).toEqual({
      slotW: 100,
      slotH: 64,
      faceW: 100,
      faceH: 200,
    })
  })

  it("nudges only the inspected crop, not the full face", () => {
    expect(
      peekStickOutSlot({
        hovered: true,
        sliverPx: 64,
        card,
        nudgePx: 20,
      })
    ).toEqual({
      slotW: 100,
      slotH: 84,
      faceW: 100,
      faceH: 200,
    })
  })
})

describe("peekPortalBox", () => {
  const dock = { left: 10, top: 800, width: 400, bottom: 864 }

  it("pins the own-hand overlay to the dock bottom", () => {
    const collapsed = peekPortalBox({
      dock,
      anchor: "bottom",
      collapsedPx: 64,
      expandedPx: 252,
      expanded: false,
      sy: 0.5,
      hoverScale: 1.28,
    })
    expect(collapsed).toEqual({
      left: 10,
      top: 832,
      paintedWidth: 400,
      paintedHeight: 32,
    })
  })

  it("grows upward when the own hand expands, with hover headroom", () => {
    const expanded = peekPortalBox({
      dock,
      anchor: "bottom",
      collapsedPx: 64,
      expandedPx: 252,
      expanded: true,
      sy: 0.5,
      hoverScale: 1.28,
    })
    expect(expanded.paintedHeight).toBeCloseTo(252 * 1.28 * 0.5)
    expect(expanded.top).toBeCloseTo(864 - 252 * 1.28 * 0.5)
  })

  it("grows downward from the opponent dock top", () => {
    const topDock = { left: 0, top: 20, width: 200, bottom: 84 }
    const expanded = peekPortalBox({
      dock: topDock,
      anchor: "top",
      collapsedPx: 64,
      expandedPx: 252,
      expanded: true,
      sy: 1,
      hoverScale: 1.28,
    })
    expect(expanded.top).toBe(20)
    expect(expanded.paintedHeight).toBeCloseTo(252 * 1.28)
  })

  it("nudges one opponent card past the sliver without revealing the face", () => {
    const topDock = { left: 0, top: 20, width: 200, bottom: 84 }
    const stick = peekPortalBox({
      dock: topDock,
      anchor: "top",
      collapsedPx: 64,
      expandedPx: 252,
      expanded: false,
      sy: 1,
      hoverScale: 1.28,
      stickOutNudgePx: 20,
    })
    expect(stick.top).toBe(20)
    expect(stick.paintedHeight).toBe(84)
    expect(stick.paintedHeight).toBeLessThan(252)
  })
})
