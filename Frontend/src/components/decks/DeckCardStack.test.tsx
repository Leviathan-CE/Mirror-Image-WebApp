import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DeckCardStack } from "@/components/decks/DeckCardStack"
import { deckEntry } from "@/test/deckEntry.fixture"

function installPointer(coarse: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches: coarse,
    media: "(pointer: coarse)",
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

function tap(element: HTMLElement) {
  fireEvent.mouseDown(element, { button: 0, clientX: 8, clientY: 8 })
  fireEvent.click(element, { button: 0, clientX: 8, clientY: 8 })
}

describe("DeckCardStack quantity controls", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens + and remove on a coarse tap instead of adding immediately", () => {
    installPointer(true)
    const onQuantityDelta = vi.fn()
    render(
      <DeckCardStack
        cards={[deckEntry({ card_id: 7, card_name: "Spirit Wire", quantity: 2 })]}
        onQuantityDelta={onQuantityDelta}
      />
    )

    tap(screen.getByTitle(/Spirit Wire/))
    expect(onQuantityDelta).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Add a copy of Spirit Wire" }))
    expect(onQuantityDelta).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2 }),
      1
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Remove a copy of Spirit Wire" })
    )
    expect(onQuantityDelta).toHaveBeenLastCalledWith(
      expect.objectContaining({ quantity: 2 }),
      -1
    )
  })

  it("keeps mouse click as +1 and right-click as remove", () => {
    installPointer(false)
    const onQuantityDelta = vi.fn()
    render(
      <DeckCardStack
        cards={[deckEntry({ card_id: 7, card_name: "Spirit Wire", quantity: 2 })]}
        onQuantityDelta={onQuantityDelta}
      />
    )

    const card = screen.getByTitle(/Spirit Wire/)
    tap(card)
    expect(onQuantityDelta).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2 }),
      1
    )
    expect(
      screen.queryByRole("button", { name: "Add a copy of Spirit Wire" })
    ).toBeNull()

    fireEvent.contextMenu(card)
    expect(onQuantityDelta).toHaveBeenLastCalledWith(
      expect.objectContaining({ quantity: 2 }),
      -1
    )
  })

  it("puts − and + inside the list row on either side of the copy count", () => {
    installPointer(true)
    render(
      <DeckCardStack
        viewMode="list"
        cards={[deckEntry({ card_id: 7, card_name: "Spirit Wire", quantity: 2 })]}
        onQuantityDelta={vi.fn()}
      />
    )

    tap(screen.getByTitle(/Spirit Wire/))
    const row = screen.getByText("Spirit Wire").closest(".deck-card-list__row")
    const adjust = row?.querySelector(".deck-card-list__adjust")
    expect(adjust).not.toBeNull()
    expect(adjust?.textContent?.replace(/\s/g, "")).toBe("−×2+")
  })
})
