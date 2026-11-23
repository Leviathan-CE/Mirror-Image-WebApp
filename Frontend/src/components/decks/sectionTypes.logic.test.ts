import { describe, expect, it } from "vitest"

import {
  sectionForAddedCard,
  sectionTypeProblem,
} from "@/components/decks/sectionTypes.logic"
import type { DeckCategoryOut } from "@/lib/api/decks"

function section(
  id: number,
  name: string,
  accept_types: string[] = []
): DeckCategoryOut {
  return { id, name, sort_order: id, in_deck: true, accept_types }
}

describe("sectionForAddedCard", () => {
  it("files a cyberspell into the cyberspell section", () => {
    const choice = sectionForAddedCard(
      [section(1, "Entity"), section(2, "Cyberspell", ["CyberSpell"])],
      { super_types: ["CyberSpell"], sub_types: ["Quick Hack"] }
    )
    expect(choice).toEqual({ kind: "section", categoryId: 2 })
  })

  it("prefers the longer type set", () => {
    const choice = sectionForAddedCard(
      [
        section(1, "Spells", ["CyberSpell"]),
        section(2, "Hacks", ["CyberSpell", "Quick Hack"]),
        section(3, "Processes", ["CyberSpell", "Process"]),
      ],
      { super_types: ["CyberSpell"], sub_types: ["Quick Hack"] }
    )
    expect(choice).toEqual({ kind: "section", categoryId: 2 })
  })

  it("treats a type line as a type when subtypes are empty", () => {
    const choice = sectionForAddedCard(
      [section(1, "Processes", ["CyberSpell", "Process"])],
      { super_types: ["CyberSpell"], sub_types: [], types_line: "Process" }
    )
    expect(choice).toEqual({ kind: "section", categoryId: 1 })
  })

  it("does not guess when two sections match equally", () => {
    const choice = sectionForAddedCard(
      [
        section(1, "Spells", ["CyberSpell"]),
        section(2, "Hacks", ["Quick Hack"]),
      ],
      { super_types: ["CyberSpell"], sub_types: ["Quick Hack"] }
    )
    expect(choice).toEqual({ kind: "ambiguous" })
  })

  it("falls back when no section claims a matching set", () => {
    const choice = sectionForAddedCard(
      [section(1, "Entity"), section(2, "Hacks", ["Quick Hack"])],
      { super_types: ["Entity"], sub_types: ["Human"] }
    )
    expect(choice).toEqual({ kind: "fallback", categoryId: 1 })
  })
})

describe("sectionTypeProblem", () => {
  const sections = [
    section(1, "Hacks", ["CyberSpell", "Quick Hack"]),
    section(2, "Processes", ["CyberSpell", "Process"]),
  ]

  it("allows a different combination that shares a type", () => {
    expect(
      sectionTypeProblem(sections, 2, ["CyberSpell", "Process"])
    ).toBeNull()
  })

  it("rejects the same set on another section", () => {
    expect(
      sectionTypeProblem(sections, 2, ["Quick Hack", "cyberspell"])
    ).toBe("taken")
  })

  it("rejects listing one type twice in a section", () => {
    expect(
      sectionTypeProblem(sections, 2, ["CyberSpell", "CyberSpell"])
    ).toBe("repeated")
  })
})
