import { describe, expect, it } from "vitest"

import { handCardSizePx } from "@/components/Playtester/handCardSize.logic"
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
