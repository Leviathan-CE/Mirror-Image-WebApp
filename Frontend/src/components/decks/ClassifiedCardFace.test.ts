import { describe, expect, it } from "vitest"

import {
  cardClassification,
  flickerStyleForSeed,
  hashSeed,
  isClassifiedCard,
} from "@/components/decks/ClassifiedCardFace"

describe("cardClassification", () => {
  it("prefers the API classification field", () => {
    expect(cardClassification({ classification: "top_secret" })).toBe(
      "top_secret"
    )
    expect(cardClassification({ classification: "classified" })).toBe(
      "classified"
    )
  })

  it("falls back to is_classified → classified", () => {
    expect(cardClassification({ is_classified: true })).toBe("classified")
    expect(cardClassification({})).toBeNull()
  })
})

describe("isClassifiedCard", () => {
  it("is true for either redaction kind", () => {
    expect(isClassifiedCard({ classification: "top_secret" })).toBe(true)
    expect(isClassifiedCard({ is_classified: true })).toBe(true)
    expect(isClassifiedCard({ is_classified: false })).toBe(false)
  })
})

describe("flickerStyleForSeed", () => {
  it("is stable for the same seed and differs across seeds", () => {
    const a = flickerStyleForSeed("Alpha")
    const a2 = flickerStyleForSeed("Alpha")
    const b = flickerStyleForSeed("Beta")
    expect(a).toEqual(a2)
    expect(a["--flicker-delay"]).not.toEqual(b["--flicker-delay"])
    expect(hashSeed("Alpha")).toBe(hashSeed("Alpha"))
    expect(hashSeed("Alpha")).not.toBe(hashSeed("Beta"))
  })
})
