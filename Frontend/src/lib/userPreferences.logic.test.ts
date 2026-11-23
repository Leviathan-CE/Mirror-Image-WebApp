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
    expect(out.deck_section_types.entity).toEqual(["Entity"])
    expect(out.deck_section_types.cyberspell).toEqual(["CyberSpell"])
    expect(out.notify_blog).toBe(true)
    expect(out.notify_cards).toBe(true)
    expect(out.notify_blog_email).toBe(false)
  })

  it("keeps notification opt-outs", () => {
    const out = normalizeUserPreferences({
      notify_blog: false,
      notify_cards: false,
      notify_blog_email: true,
    })
    expect(out.notify_blog).toBe(false)
    expect(out.notify_cards).toBe(false)
    expect(out.notify_blog_email).toBe(true)
  })

  it("clamps sizes", () => {
    expect(clampBrowseWidth(10)).toBe(280)
    expect(clampPreviewPx(900)).toBe(300)
  })

  it("detects unset blobs", () => {
    expect(preferencesAreUnset({})).toBe(true)
    expect(preferencesAreUnset({ deck_view: "list" })).toBe(false)
  })

  it("keeps a cleared type list and drops repeats", () => {
    const out = normalizeUserPreferences({
      deck_start_sections: ["Entity", "Cyberspell"],
      deck_section_types: {
        entity: [],
        cyberspell: ["CyberSpell", "cyberspell"],
      },
    })
    expect(out.deck_section_types.entity).toEqual([])
    expect(out.deck_section_types.cyberspell).toEqual(["CyberSpell"])
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
