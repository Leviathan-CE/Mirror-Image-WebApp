import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DeckPrintoutDialog } from "@/components/decks/DeckPrintoutDialog"
import type { DeckPrintoutSlot } from "@/components/decks/deckPrintout.logic"
import { FREE_CARD_BACK_OPTION } from "@/lib/api/assets"

const slots: DeckPrintoutSlot[] = [
  {
    card_id: 1,
    card_name: "Pilot",
    card_art_path: null,
    section: "pilot",
  },
]

describe("DeckPrintoutDialog", () => {
  it("offers preview, backs, margin, and file name then submits them", async () => {
    const user = userEvent.setup()
    const onGenerate = vi.fn()

    render(
      <DeckPrintoutDialog
        open
        slots={slots}
        deckName="Core Set"
        cardBackOptions={[FREE_CARD_BACK_OPTION]}
        busy={false}
        onCancel={vi.fn()}
        onGenerate={onGenerate}
      />
    )

    expect(
      screen.getByRole("dialog", { name: "Print deck" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", { name: /print card backs/i })
    ).toBeChecked()
    expect(
      screen.getByDisplayValue("Core_Set_printout.pdf")
    ).toBeInTheDocument()
    expect(screen.getByText("Pilot")).toBeInTheDocument()
    expect(
      screen.queryByRole("radio", { name: /free card back/i })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("checkbox", { name: /print card backs/i })
    )
    await user.click(screen.getByRole("button", { name: "Create PDF" }))

    expect(onGenerate).toHaveBeenCalledWith({
      includeBacks: false,
      marginMm: 10,
      fileName: "Core_Set_printout.pdf",
      cardBackUrl: null,
    })
  })

  it("lets staff pick between free and original backs", async () => {
    const user = userEvent.setup()
    const onGenerate = vi.fn()
    const options = [
      FREE_CARD_BACK_OPTION,
      {
        id: "standard",
        label: "Original card back",
        src: "/media/system/card_back.png?sig=1",
      },
    ]

    render(
      <DeckPrintoutDialog
        open
        slots={slots}
        deckName="Admin Deck"
        cardBackOptions={options}
        busy={false}
        onCancel={vi.fn()}
        onGenerate={onGenerate}
      />
    )

    const original = screen.getByRole("radio", {
      name: /original card back/i,
    })
    await user.click(original)
    await user.click(screen.getByRole("button", { name: "Create PDF" }))

    expect(onGenerate).toHaveBeenCalledWith({
      includeBacks: true,
      marginMm: 10,
      fileName: "Admin_Deck_printout.pdf",
      cardBackUrl: options[1].src,
    })
  })
})
