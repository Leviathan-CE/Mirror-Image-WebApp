import { describe, expect, it } from "vitest"

import {
  browseMessageFromLocalUi,
  peerBrowseOppPile,
  peerBrowseStatusLabel,
} from "@/components/Playtester/net/browseIndicator.logic"
import { isPlayNetMessage } from "@/components/Playtester/net/playNet.logic"

describe("browseMessageFromLocalUi", () => {
  it("prefers look-at-top over deck search and pile browser", () => {
    expect(
      browseMessageFromLocalUi({
        deckPeekCount: 3,
        deckSearchOpen: true,
        pileBrowser: "trashyard",
      })
    ).toEqual({ type: "browse", pile: "library-top", count: 3 })
  })

  it("maps deck search and own pile browsers", () => {
    expect(
      browseMessageFromLocalUi({
        deckPeekCount: null,
        deckSearchOpen: true,
        pileBrowser: null,
      })
    ).toEqual({ type: "browse", pile: "library" })

    expect(
      browseMessageFromLocalUi({
        deckPeekCount: null,
        deckSearchOpen: false,
        pileBrowser: "trashyard",
      })
    ).toEqual({ type: "browse", pile: "trashyard" })

    expect(
      browseMessageFromLocalUi({
        deckPeekCount: null,
        deckSearchOpen: false,
        pileBrowser: "dismantled",
      })
    ).toEqual({ type: "browse", pile: "dismantled" })
  })

  it("clears when nothing is open", () => {
    expect(
      browseMessageFromLocalUi({
        deckPeekCount: null,
        deckSearchOpen: false,
        pileBrowser: null,
      })
    ).toEqual({ type: "browse", pile: null })
  })
})

describe("peerBrowseStatusLabel / peerBrowseOppPile", () => {
  it("builds Searching… and Looking at top N copy", () => {
    expect(peerBrowseStatusLabel(null)).toBeNull()
    expect(peerBrowseStatusLabel({ type: "browse", pile: null })).toBeNull()
    expect(
      peerBrowseStatusLabel({ type: "browse", pile: "library" })
    ).toBe("Searching…")
    expect(
      peerBrowseStatusLabel({ type: "browse", pile: "trashyard" })
    ).toBe("Searching…")
    expect(
      peerBrowseStatusLabel({ type: "browse", pile: "dismantled" })
    ).toBe("Searching…")
    expect(
      peerBrowseStatusLabel({ type: "browse", pile: "library-top", count: 5 })
    ).toBe("Looking at top 5")
  })

  it("routes labels to the matching opp pile", () => {
    expect(peerBrowseOppPile(null)).toBeNull()
    expect(peerBrowseOppPile({ type: "browse", pile: null })).toBeNull()
    expect(peerBrowseOppPile({ type: "browse", pile: "library" })).toBe(
      "library"
    )
    expect(
      peerBrowseOppPile({ type: "browse", pile: "library-top", count: 2 })
    ).toBe("library")
    expect(peerBrowseOppPile({ type: "browse", pile: "trashyard" })).toBe(
      "trashyard"
    )
    expect(peerBrowseOppPile({ type: "browse", pile: "dismantled" })).toBe(
      "dismantled"
    )
  })
})

describe("browse net envelopes", () => {
  it("accepts browse messages as PlayNet envelopes", () => {
    expect(isPlayNetMessage({ type: "browse", pile: null })).toBe(true)
    expect(isPlayNetMessage({ type: "browse", pile: "library" })).toBe(true)
    expect(
      isPlayNetMessage({ type: "browse", pile: "library-top", count: 4 })
    ).toBe(true)
  })
})
