import { describe, expect, it } from "vitest"

import { cardDiffRows } from "./inboxCardDiff.logic"

describe("cardDiffRows", () => {
  it("lists only changed fields for an update", () => {
    const rows = cardDiffRows(
      { card_name: "A", description: "old", invoke_cost: 1 },
      { card_name: "A", description: "new", invoke_cost: 1 }
    )
    const changed = rows.filter((row) => row.changed).map((row) => row.key)
    expect(changed).toEqual(["description"])
    expect(rows.find((row) => row.key === "description")?.after).toBe("new")
  })

  it("keeps snapshot fields for a new card", () => {
    const rows = cardDiffRows(null, {
      card_name: "Bolt",
      description: "Deal 1",
    })
    expect(rows.some((row) => row.key === "card_name")).toBe(true)
    expect(rows.find((row) => row.key === "card_name")?.after).toBe("Bolt")
  })
})
