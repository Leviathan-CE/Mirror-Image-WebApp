import { describe, expect, it } from "vitest"

import {
  clampDeckCount,
  degradeTopLibrary,
  filterLibraryByName,
  groupCardsByPrinting,
  libraryCardsInOrder,
  peekTopLibrary,
  putTopLibraryOnBottom,
  reorderTopLibrary,
  shuffleLibrary,
} from "@/components/Playtester/deckActions.logic"
import type { PlayingCardInstance } from "@/components/Playtester/playCard.logic"

function card(
  id: string,
  zone: PlayingCardInstance["zone"],
  name = id,
  cardId = 1
): PlayingCardInstance {
  return {
    instanceId: id,
    cardId,
    name,
    artPath: null,
    artVersion: null,
    cost: [],
    zone,
    expended: false,
  }
}

describe("deckActions.logic", () => {
  const mixed = [
    card("a", "library", "Alpha"),
    card("h", "hand", "Hand"),
    card("b", "library", "Beta"),
    card("c", "library", "Gamma"),
  ]

  it("libraryCardsInOrder keeps array order (first = top)", () => {
    expect(libraryCardsInOrder(mixed).map((c) => c.instanceId)).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("peekTopLibrary returns top n without mutating zones", () => {
    expect(peekTopLibrary(mixed, 2).map((c) => c.instanceId)).toEqual([
      "a",
      "b",
    ])
    expect(libraryCardsInOrder(mixed)).toHaveLength(3)
  })

  it("degradeTopLibrary mills top n into trashyard (last milled on top)", () => {
    const next = degradeTopLibrary(mixed, 2)
    expect(libraryCardsInOrder(next).map((c) => c.instanceId)).toEqual(["c"])
    const trash = next.filter((c) => c.zone === "trashyard")
    expect(trash.map((c) => c.instanceId)).toEqual(["a", "b"])
  })

  it("putTopLibraryOnBottom rotates the top n to the bottom in order", () => {
    const next = putTopLibraryOnBottom(mixed, 2)
    expect(libraryCardsInOrder(next).map((c) => c.instanceId)).toEqual([
      "c",
      "a",
      "b",
    ])
  })

  it("putTopLibraryOnBottom is a no-op for 0 or the whole deck", () => {
    expect(putTopLibraryOnBottom(mixed, 0)).toBe(mixed)
    expect(putTopLibraryOnBottom(mixed, 3)).toBe(mixed)
  })

  it("shuffleLibrary only reorders library cards", () => {
    const big = [
      card("h", "hand"),
      ...Array.from({ length: 12 }, (_, i) => card(`L${i}`, "library")),
    ]
    const once = shuffleLibrary(big)
    const twice = shuffleLibrary(big)
    expect(once.filter((c) => c.zone === "hand")).toHaveLength(1)
    expect(libraryCardsInOrder(once)).toHaveLength(12)
    const idsOnce = libraryCardsInOrder(once).map((c) => c.instanceId).join()
    const idsTwice = libraryCardsInOrder(twice).map((c) => c.instanceId).join()
    const idsOrig = libraryCardsInOrder(big).map((c) => c.instanceId).join()
    // Extremely unlikely both shuffles match original order for 12 cards.
    expect(idsOnce === idsOrig && idsTwice === idsOrig).toBe(false)
  })

  it("filterLibraryByName matches substring case-insensitively", () => {
    expect(
      filterLibraryByName(mixed, "bet").map((c) => c.instanceId)
    ).toEqual(["b"])
    expect(filterLibraryByName(mixed, "").map((c) => c.instanceId)).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("clampDeckCount respects library size", () => {
    expect(clampDeckCount(99, 5)).toBe(5)
    expect(clampDeckCount(-1, 5)).toBe(0)
    expect(clampDeckCount(2.9, 5)).toBe(2)
  })

  it("reorderTopLibrary puts the new sequence on top of the deck", () => {
    const next = reorderTopLibrary(mixed, ["c", "a", "b"])
    expect(libraryCardsInOrder(next).map((c) => c.instanceId)).toEqual([
      "c",
      "a",
      "b",
    ])
    expect(next.find((c) => c.zone === "hand")?.instanceId).toBe("h")
  })

  it("reorderTopLibrary no-ops on a mismatched id set", () => {
    expect(reorderTopLibrary(mixed, ["a", "h"])).toBe(mixed)
  })

  it("groupCardsByPrinting collapses copies in first-appearance order", () => {
    const copies = [
      card("a1", "library", "Alpha", 10),
      card("b1", "library", "Beta", 20),
      card("a2", "library", "Alpha", 10),
      card("a3", "library", "Alpha", 10),
    ]
    const groups = groupCardsByPrinting(copies)
    expect(groups.map((g) => g.cardId)).toEqual([10, 20])
    expect(groups[0]!.instances.map((c) => c.instanceId)).toEqual([
      "a1",
      "a2",
      "a3",
    ])
    // Topmost copy represents the group, so dragging pulls it off the top.
    expect(groups[0]!.display.instanceId).toBe("a1")
    expect(groups[1]!.instances).toHaveLength(1)
  })

  it("groupCardsByPrinting returns nothing for an empty list", () => {
    expect(groupCardsByPrinting([])).toEqual([])
  })
})
