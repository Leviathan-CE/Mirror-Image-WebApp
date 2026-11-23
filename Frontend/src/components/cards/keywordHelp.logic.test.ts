import { describe, expect, it } from "vitest"

import { parseKeyword, splitHelpAtX } from "./keywordHelp.logic"

describe("parseKeyword", () => {
  it("splits a stealth cost into icon tokens", () => {
    const parsed = parseKeyword("Stealth:GEN2")
    expect(parsed.name).toBe("Stealth")
    expect(parsed.paramTokens).toEqual(["GEN2"])
    expect(parsed.helpKey).toBe("STEALTH X")
  })

  it("keeps repeated costs as separate tokens", () => {
    const parsed = parseKeyword("Stealth:LIF+LIF")
    expect(parsed.paramTokens).toEqual(["LIF", "LIF"])
  })

  it("leaves a non-cost parameter as one token", () => {
    const parsed = parseKeyword("Stealth:DiscardACard")
    expect(parsed.paramTokens).toEqual(["DiscardACard"])
  })

  it("splits the stealth reminder at the cost X", () => {
    const parsed = parseKeyword("Stealth:GEN2")
    const split = splitHelpAtX(parsed.help)
    expect(split?.before.endsWith("pay ")).toBe(true)
    expect(split?.after.startsWith(".")).toBe(true)
  })

  it("has no cost tokens when the keyword has no parameter", () => {
    const parsed = parseKeyword("Blitz")
    expect(parsed.name).toBe("Blitz")
    expect(parsed.paramTokens).toEqual([])
  })
})
