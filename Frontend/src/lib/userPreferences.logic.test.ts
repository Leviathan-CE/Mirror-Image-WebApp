import { describe, expect, it } from "vitest"

import {
  clampBrowseWidth,
  clampPreviewPx,
  normalizeStartSections,
  normalizeUserPreferences,
  preferencesAreUnset,
  resizeStartSections,
} from "./userPreferences.logic"

describe("normalizeUserPreferences", () => {
  it("fills defaults and drops junk", () => {
    const out = normalizeUserPreferences({
      deck_view: "list",
      deck_sort: "nope",
      extra: 1,
    })
    expect(out.deck_view).toBe("list")
    expect(out.deck_sort).toBe("type")
    expect(out.library_sort).toBe("name")
    expect(out.deck_start_sections).toEqual(["Entity", "Cyberspell"])
    expect(out.notify_blog).toBe(true)
    expect(out.notify_cards).toBe(true)
  })

  it("keeps notification opt-outs", () => {
    const out = normalizeUserPreferences({
      notify_blog: false,
      notify_cards: false,
    })
    expect(out.notify_blog).toBe(false)
    expect(out.notify_cards).toBe(false)
  })

  it("clamps sizes", () => {
    expect(clampBrowseWidth(10)).toBe(280)
    expect(clampPreviewPx(900)).toBe(200)
  })

  it("detects unset blobs", () => {
    expect(preferencesAreUnset({})).toBe(true)
    expect(preferencesAreUnset({ deck_view: "list" })).toBe(false)
  })

  it("normalizes starting sections", () => {
    expect(
      normalizeStartSections([" Main ", "Main", "Pilot", "", "Side"])
    ).toEqual(["Main", "Side"])
    expect(resizeStartSections(["Entity"], 3)).toEqual([
      "Entity",
      "New Section",
      "New Section 2",
    ])
  })
})
