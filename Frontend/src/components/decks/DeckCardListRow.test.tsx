import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DeckCardListRow } from "./DeckCardListRow"
import type { DeckCardEntry } from "@/lib/api/decks"
import { deckEntry } from "@/test/deckEntry.fixture"

function card(overrides: Parameters<typeof deckEntry>[0] = {}): DeckCardEntry {
  return deckEntry({
    card_id: 1,
    card_name: "Spirit Wire",
    quantity: 2,
    category_id: 4,
    category_name: "Main",
    invoke_cost: 3,
    has_invoke_cost: true,
    cost: ["LIF", "RAM"],
    threat_level: "4",
    is_summon: true,
    ...overrides,
  })
}

describe("DeckCardListRow", () => {
  it("hides TLV when it is zero", () => {
    render(
      <DeckCardListRow
        card={card({ threat_level: "0", is_summon: true })}
        classified={null}
      />
    )
    expect(screen.queryByTitle("Threat level")).not.toBeInTheDocument()
  })

  it("hides TLV on non-summon cards even when threat_level is set", () => {
    render(
      <DeckCardListRow
        card={card({ threat_level: "4", is_summon: false })}
        classified={null}
      />
    )
    expect(screen.queryByTitle("Threat level")).not.toBeInTheDocument()
  })

  it("redacts cost and TLV for classified cards", () => {
    const { container } = render(
      <DeckCardListRow
        card={card({
          classification: "classified",
          is_classified: true,
          card_art_path: "art/secret.png",
        })}
        classified="classified"
      />
    )
    expect(screen.queryByTitle("Life (LIF)")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Threat level")).not.toBeInTheDocument()
    expect(container.querySelector(".deck-card-list__hover-art")).toBeNull()
  })

  it("shows a hover thumbnail with art when the pointer moves over the row", () => {
    render(
      <DeckCardListRow
        card={card({ card_art_path: "art/wire.png", card_art_version: 2 })}
        classified={null}
      />
    )

    const row = screen.getByText("Spirit Wire").closest(".deck-card-list__row")!
    expect(document.querySelector(".deck-card-list__hover-art")).toBeNull()

    fireEvent.mouseMove(row, { clientX: 40, clientY: 80 })
    const thumb = document.querySelector(".deck-card-list__hover-art")
    expect(thumb).toBeInstanceOf(HTMLImageElement)
    expect(thumb).toHaveAttribute("src", expect.stringContaining("art/wire.png"))
  })
})
