import { describe, expect, it } from "vitest"

import {
  DECK_COLOR_HEX,
  cardColorIdentity,
  deckCardRowBackground,
} from "./deckCardColors"

describe("cardColorIdentity", () => {
  it("reads a single solid pip", () => {
    expect(cardColorIdentity(["POW"])).toEqual(["POW"])
  })

  it("keeps unique colours in pip order", () => {
    expect(cardColorIdentity(["LIF", "LIF", "RAM"])).toEqual(["LIF", "RAM"])
  })

  it("splits hybrid pips into both colours", () => {
    expect(cardColorIdentity(["LIF-POW"])).toEqual(["LIF", "POW"])
  })

  it("ignores generic / numbered costs", () => {
    expect(cardColorIdentity(["GEN2"])).toEqual([])
    expect(cardColorIdentity(["GEN", "GENX"])).toEqual([])
  })

  it("expands MULTI to every resource colour", () => {
    expect(cardColorIdentity(["MULTI"])).toEqual([
      "LIF",
      "MET",
      "POW",
      "RAM",
      "TIM",
      "STL",
    ])
  })

  it("treats empty cost as colourless", () => {
    expect(cardColorIdentity([])).toEqual([])
    expect(cardColorIdentity(null)).toEqual([])
  })
})

describe("deckCardRowBackground", () => {
  it("uses a solid fill for one colour", () => {
    expect(deckCardRowBackground(["RAM"])).toBe(DECK_COLOR_HEX.RAM)
  })

  it("builds a left-to-right gradient for multiple colours", () => {
    const fill = deckCardRowBackground(["LIF", "RAM"])
    expect(fill).toBe(
      `linear-gradient(90deg, ${DECK_COLOR_HEX.LIF}, ${DECK_COLOR_HEX.RAM})`
    )
  })

  it("falls back for colourless costs", () => {
    expect(deckCardRowBackground(["GEN3"])).toBe("#334155")
  })
})
