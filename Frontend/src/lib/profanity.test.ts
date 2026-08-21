import { describe, expect, it } from "vitest"

import {
  containsProfanity,
  findProfanity,
  isPublicTextClean,
} from "@/lib/profanity"

describe("profanity filter", () => {
  it("allows clean public text", () => {
    expect(findProfanity("Aggro Midrange")).toBeNull()
    expect(findProfanity("classic control")).toBeNull()
    expect(isPublicTextClean("Pilot", "fun deck")).toBe(true)
  })

  it("blocks obvious terms", () => {
    expect(containsProfanity("this is fucking broken")).toBe(true)
    expect(findProfanity("Shit")).toBe("shit")
  })

  it("catches light leetspeak / separators", () => {
    expect(containsProfanity("f.u.c.k")).toBe(true)
    expect(containsProfanity("sh1t")).toBe(true)
  })
})
