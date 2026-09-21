import { describe, expect, it } from "vitest"

import { costTokenToIcon } from "@/components/cards/constants"

describe("costTokenToIcon", () => {
  it("maps hyphen hybrids", () => {
    expect(costTokenToIcon("LIF-POW")).toBe("lifPow")
  })

  it("maps Unity underscore hybrids", () => {
    expect(costTokenToIcon("LIF_POW")).toBe("lifPow")
    expect(costTokenToIcon("pow_lif")).toBe("lifPow")
  })

  it("still maps solid colours", () => {
    expect(costTokenToIcon("MET")).toBe("metal")
  })
})
