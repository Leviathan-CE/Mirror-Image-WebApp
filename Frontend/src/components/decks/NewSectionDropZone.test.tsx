import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DECK_CARD_DRAG_MIME } from "./deckCardDrag"
import { NewSectionDropZone } from "./NewSectionDropZone"

function dragDataTransfer(payload: object) {
  const encoded = JSON.stringify(payload)
  return {
    types: [DECK_CARD_DRAG_MIME, "text/plain"],
    getData: (type: string) =>
      type === DECK_CARD_DRAG_MIME || type === "text/plain" ? encoded : "",
    dropEffect: "none",
  }
}

describe("NewSectionDropZone", () => {
  it("calls onDropCard with the parsed payload", () => {
    const onDropCard = vi.fn()
    render(<NewSectionDropZone onDropCard={onDropCard} />)

    const zone = screen.getByText("NEW SECTION").parentElement
    expect(zone).toBeTruthy()

    const payload = { cardId: 42, fromCategoryId: 7 }
    fireEvent.drop(zone!, {
      dataTransfer: dragDataTransfer(payload),
    })

    expect(onDropCard).toHaveBeenCalledWith(payload)
  })

  it("ignores drops while disabled", () => {
    const onDropCard = vi.fn()
    render(<NewSectionDropZone disabled onDropCard={onDropCard} />)

    const zone = screen.getByText("NEW SECTION").parentElement!
    fireEvent.drop(zone, {
      dataTransfer: dragDataTransfer({ cardId: 1, fromCategoryId: 2 }),
    })
    expect(onDropCard).not.toHaveBeenCalled()
  })
})
