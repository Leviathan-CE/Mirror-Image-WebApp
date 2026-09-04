import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DECK_CARD_DRAG_MIME } from "./deckCardDrag"
import { DeckPilotSlot } from "./DeckPilotSlot"
import type { DeckCardEntry } from "@/lib/api/decks"
import { deckEntry } from "@/test/deckEntry.fixture"

const pilot: DeckCardEntry = deckEntry({
  card_id: 99,
  card_name: "Diana Ugisaki",
  quantity: 1,
  category_id: 1,
  category_name: "Pilot",
  sort_order: 0,
  card_art_path: null,
})

function dragDataTransfer(payload: object) {
  const encoded = JSON.stringify(payload)
  return {
    types: [DECK_CARD_DRAG_MIME, "text/plain"],
    getData: (type: string) =>
      type === DECK_CARD_DRAG_MIME || type === "text/plain" ? encoded : "",
    dropEffect: "none",
  }
}

describe("DeckPilotSlot", () => {
  it("calls onDropCard when a card is dropped", () => {
    const onDropCard = vi.fn()
    render(
      <DeckPilotSlot
        pilot={null}
        canEdit
        onDropCard={onDropCard}
      />
    )

    const slot = screen.getByText("Drop pilot card here").parentElement!
    fireEvent.drop(slot, {
      dataTransfer: dragDataTransfer({ cardId: 5, fromCategoryId: 3 }),
    })
    expect(onDropCard).toHaveBeenCalledWith({
      cardId: 5,
      fromCategoryId: 3,
    })
  })

  it("calls onClear on right-click when editable", async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <DeckPilotSlot
        pilot={pilot}
        canEdit
        onDropCard={vi.fn()}
        onClear={onClear}
      />
    )

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByTitle(/right-click to clear/i),
    })
    expect(onClear).toHaveBeenCalledOnce()
  })

  it("shows enlarge overlay on middle-mouse hold", () => {
    render(
      <DeckPilotSlot pilot={pilot} canEdit={false} onDropCard={vi.fn()} />
    )

    const frame = screen.getByTitle(/middle-click hold to enlarge/i)
    fireEvent.mouseDown(frame, { button: 1 })
    expect(
      screen.getByRole("dialog", { name: pilot.card.card_name })
    ).toBeInTheDocument()

    fireEvent.mouseUp(window)
    expect(
      screen.queryByRole("dialog", { name: pilot.card.card_name })
    ).not.toBeInTheDocument()
  })
})
