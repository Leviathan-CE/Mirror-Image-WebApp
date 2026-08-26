import { describe, expect, it } from "vitest"

import {
  cycleGroupSelection,
  selectSingleFromGroup,
  selectedCountInGroup,
  trashDragGroupIds,
} from "@/components/Playtester/trashyardSelect.logic"

const group3 = {
  cardId: 10,
  instances: [
    { instanceId: "a" },
    { instanceId: "b" },
    { instanceId: "c" },
  ],
}

describe("cycleGroupSelection", () => {
  it("cycles 0 → 1 → 2 → 3 → 0 on a ×3 group", () => {
    let sel: string[] = []
    sel = cycleGroupSelection(group3, sel)
    expect(sel).toEqual(["c"])
    sel = cycleGroupSelection(group3, sel)
    expect(sel).toEqual(["b", "c"])
    sel = cycleGroupSelection(group3, sel)
    expect(sel).toEqual(["a", "b", "c"])
    sel = cycleGroupSelection(group3, sel)
    expect(sel).toEqual([])
  })

  it("preserves other groups while cycling", () => {
    const sel = cycleGroupSelection(group3, ["other"])
    expect(sel).toEqual(["other", "c"])
  })
})

describe("selectSingleFromGroup", () => {
  it("picks only the topmost copy", () => {
    expect(selectSingleFromGroup(group3)).toEqual(["c"])
  })
})

describe("selectedCountInGroup", () => {
  it("counts only this group's ids", () => {
    expect(selectedCountInGroup(group3, ["b", "c", "x"])).toBe(2)
  })
})

describe("trashDragGroupIds", () => {
  it("moves the whole selection when the drag target is selected", () => {
    expect(trashDragGroupIds("b", ["a", "b"])).toEqual(["a", "b"])
  })

  it("moves only the dragged card when it is not in the selection", () => {
    expect(trashDragGroupIds("c", ["a", "b"])).toEqual(["c"])
    expect(trashDragGroupIds("c", [])).toEqual(["c"])
  })
})
