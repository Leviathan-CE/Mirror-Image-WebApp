import { describe, expect, it } from "vitest"

import { selectionAfterClick } from "./inboxSelection.logic"

const orderedIds = [1, 2, 3, 4]

describe("selectionAfterClick", () => {
  it("toggles one row for ctrl click", () => {
    const first = selectionAfterClick({
      orderedIds,
      selectedIds: [],
      anchorId: null,
      targetId: 2,
      shift: false,
      ctrl: true,
    })
    expect(first.selectedIds).toEqual([2])
    expect(first.anchorId).toBe(2)

    const second = selectionAfterClick({
      orderedIds,
      selectedIds: first.selectedIds,
      anchorId: first.anchorId,
      targetId: 4,
      shift: false,
      ctrl: true,
    })
    expect(second.selectedIds).toEqual([2, 4])

    const removed = selectionAfterClick({
      orderedIds,
      selectedIds: second.selectedIds,
      anchorId: second.anchorId,
      targetId: 2,
      shift: false,
      ctrl: true,
    })
    expect(removed.selectedIds).toEqual([4])
  })

  it("selects the inclusive range for shift click", () => {
    const result = selectionAfterClick({
      orderedIds,
      selectedIds: [2],
      anchorId: 2,
      targetId: 4,
      shift: true,
      ctrl: false,
    })
    expect(result.selectedIds).toEqual([2, 3, 4])
    expect(result.anchorId).toBe(2)
  })

  it("adds a range without dropping the earlier pick", () => {
    const result = selectionAfterClick({
      orderedIds,
      selectedIds: [1],
      anchorId: 3,
      targetId: 4,
      shift: true,
      ctrl: true,
    })
    expect(result.selectedIds).toEqual([1, 3, 4])
  })
})
